import { Injectable } from "@nestjs/common";
import { Prisma, type Transaction } from "@prisma/client";
import { AuditWriterService } from "../common/services/audit-writer.service";
import { IdempotencyReplayService } from "../common/services/idempotency-replay.service";
import { isPrismaUniqueViolation } from "../common/utils/prisma-errors.util";
import {
  formatMoney,
  toDecimal,
  toPrismaDecimal,
} from "../lib/money";
import {
  accountClosed,
  accountNotFound,
  DomainError,
  insufficientFunds,
  invalidRequest,
  isDomainError,
  notReversible,
  transactionNotFound,
} from "../models/errors";
import { mapMoneyMovement } from "../models/mappers";
import type { ReverseRequest, ReverseResult } from "../models/money-movement";
import { AccountRepository } from "../repositories/account.repository";
import { AuditRepository } from "../repositories/audit.repository";
import { IdempotencyRepository } from "../repositories/idempotency.repository";
import { LedgerRepository } from "../repositories/ledger.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import type { DbClient } from "../prisma/prisma.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReverseResponseDto } from "./dto/reverse-response.dto";
import { mapReverseResultToDto } from "./mappers/reversal.mapper";

const REVERSE_IDEMPOTENCY_STATUS = 201;

@Injectable()
export class ReversalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly ledgerRepository: LedgerRepository,
    private readonly auditRepository: AuditRepository,
    private readonly idempotencyRepository: IdempotencyRepository,
    private readonly auditWriter: AuditWriterService,
    private readonly idempotencyReplay: IdempotencyReplayService,
  ) {}

  async reverse(request: ReverseRequest): Promise<ReverseResponseDto> {
    if (!request.idempotencyKey?.trim()) {
      throw invalidRequest("Idempotency-Key is required");
    }
    if (!request.requestId?.trim()) {
      throw invalidRequest("Request ID is required");
    }

    const cached = await this.idempotencyReplay.findCached(
      request.idempotencyKey,
    );
    if (cached) {
      return mapReverseResultToDto(
        this.idempotencyReplay.replayReverse(cached, request.transactionId),
      );
    }

    try {
      const result = await this.executeReverse(request);
      return mapReverseResultToDto(result);
    } catch (error) {
      const raced = await this.resolveIdempotencyRace(request, error);
      if (raced) {
        return mapReverseResultToDto(raced);
      }

      if (isDomainError(error)) {
        await this.writeReverseFailureAudit(request, error);
      }
      throw error;
    }
  }

  private async executeReverse(request: ReverseRequest): Promise<ReverseResult> {
    return this.prisma.$transaction(async (tx) => {
      const existingByKey =
        await this.transactionRepository.findByIdempotencyKey(
          tx,
          request.idempotencyKey,
        );
      if (existingByKey?.reversesTransactionId) {
        return this.buildResult(
          tx,
          existingByKey.reversesTransactionId,
          existingByKey,
          true,
        );
      }

      const original = await this.transactionRepository.lockTransactionForUpdate(
        tx,
        request.transactionId,
      );
      if (!original) {
        throw transactionNotFound(request.transactionId);
      }

      if (original.type !== "transfer") {
        throw notReversible("Only completed transfers can be reversed");
      }
      if (original.status === "reversed") {
        const existingReversal =
          await this.transactionRepository.findReversalForOriginal(
            tx,
            original.id,
          );
        if (existingReversal) {
          return this.buildResult(tx, original.id, existingReversal, true);
        }
        throw notReversible("Transfer is already reversed");
      }
      if (original.status !== "completed") {
        throw notReversible("Only completed transfers can be reversed");
      }
      if (!original.fromAccountId || !original.toAccountId) {
        throw notReversible("Transfer is missing account references");
      }

      const existingReversal =
        await this.transactionRepository.findReversalForOriginal(
          tx,
          original.id,
        );
      if (existingReversal) {
        return this.buildResult(tx, original.id, existingReversal, true);
      }

      const amount = toDecimal(original.amount);
      const prismaAmount = toPrismaDecimal(amount);

      const lockedAccounts = await this.accountRepository.lockAccountsForUpdate(
        tx,
        original.fromAccountId,
        original.toAccountId,
      );

      const source = lockedAccounts.get(original.fromAccountId);
      const destination = lockedAccounts.get(original.toAccountId);

      if (!source) {
        throw accountNotFound(original.fromAccountId);
      }
      if (!destination) {
        throw accountNotFound(original.toAccountId);
      }
      if (source.status === "closed") {
        throw accountClosed(original.fromAccountId);
      }
      if (destination.status === "closed") {
        throw accountClosed(original.toAccountId);
      }
      if (destination.balance.lt(amount)) {
        throw insufficientFunds(
          formatMoney(destination.balance),
          formatMoney(amount),
        );
      }

      await this.accountRepository.creditBalance(
        tx,
        original.fromAccountId,
        prismaAmount,
      );
      await this.accountRepository.debitBalance(
        tx,
        original.toAccountId,
        prismaAmount,
      );

      const reversal = await this.transactionRepository.createCompletedReversal(
        tx,
        {
          fromAccountId: original.fromAccountId,
          toAccountId: original.toAccountId,
          amount,
          originalTransactionId: original.id,
          idempotencyKey: request.idempotencyKey,
        },
      );

      await this.ledgerRepository.createReversalEntries(tx, {
        transactionId: reversal.id,
        fromAccountId: original.fromAccountId,
        toAccountId: original.toAccountId,
        amount,
      });

      await this.transactionRepository.markReversed(tx, original.id);

      await this.auditRepository.createInTransaction(tx, {
        operationType: "REVERSE",
        outcome: "success",
        requestId: request.requestId,
        fromAccountId: original.fromAccountId,
        toAccountId: original.toAccountId,
        amount,
        transactionId: reversal.id,
        idempotencyKey: request.idempotencyKey,
        payload: {
          originalTransactionId: original.id,
          amount: formatMoney(amount),
        },
      });

      const result = await this.buildResult(tx, original.id, reversal, false);

      await this.idempotencyRepository.saveInTransaction(tx, {
        key: request.idempotencyKey,
        operation: "reverse",
        responseStatus: REVERSE_IDEMPOTENCY_STATUS,
        responseBody: JSON.parse(
          JSON.stringify(result),
        ) as Prisma.InputJsonValue,
      });

      return result;
    });
  }

  private async resolveIdempotencyRace(
    request: ReverseRequest,
    error: unknown,
  ): Promise<ReverseResult | null> {
    if (!isPrismaUniqueViolation(error)) {
      return null;
    }

    const existing = await this.transactionRepository.findByIdempotencyKey(
      this.prisma,
      request.idempotencyKey,
    );
    if (existing?.reversesTransactionId) {
      return this.buildResult(
        this.prisma,
        existing.reversesTransactionId,
        existing,
        true,
      );
    }

    const cachedRetry = await this.idempotencyReplay.findCached(
      request.idempotencyKey,
    );
    if (cachedRetry) {
      return this.idempotencyReplay.replayReverse(
        cachedRetry,
        request.transactionId,
      );
    }

    return null;
  }

  private async buildResult(
    tx: DbClient,
    originalId: string,
    reversal: Transaction,
    idempotentReplay: boolean,
  ): Promise<ReverseResult> {
    const original = await this.transactionRepository.findById(tx, originalId);
    if (!original) {
      throw transactionNotFound(originalId);
    }

    return {
      reversal: mapMoneyMovement(reversal),
      originalTransaction: mapMoneyMovement(original),
      idempotentReplay,
    };
  }

  private writeReverseFailureAudit(
    request: ReverseRequest,
    error: DomainError,
  ): Promise<void> {
    return this.auditWriter.writeFailure(
      {
        operationType: "REVERSE",
        outcome: "failure",
        requestId: request.requestId,
        transactionId: request.transactionId,
        idempotencyKey: request.idempotencyKey,
        errorCode: error.code,
        errorMessage: error.message,
        payload: { transactionId: request.transactionId },
      },
      "reversal failure",
    );
  }
}
