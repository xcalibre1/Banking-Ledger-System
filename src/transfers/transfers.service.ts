import { Injectable } from "@nestjs/common";
import { Prisma, type Transaction } from "@prisma/client";
import type { Decimal } from "decimal.js";
import { AuditWriterService } from "../common/services/audit-writer.service";
import { IdempotencyReplayService } from "../common/services/idempotency-replay.service";
import {
  isDeadlock,
  isPrismaUniqueViolation,
} from "../common/utils/prisma-errors.util";
import {
  formatMoney,
  parseAndValidateAmount,
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
  sameAccountTransfer,
} from "../models/errors";
import { mapMoneyMovement } from "../models/mappers";
import type { TransferRequest, TransferResult } from "../models/transfer";
import { AccountRepository } from "../repositories/account.repository";
import { AuditRepository } from "../repositories/audit.repository";
import { IdempotencyRepository } from "../repositories/idempotency.repository";
import { LedgerRepository } from "../repositories/ledger.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import type { DbClient } from "../prisma/prisma.service";
import { PrismaService } from "../prisma/prisma.service";
import { TransferResponseDto } from "./dto/transfer-response.dto";
import { mapTransferResultToDto } from "./mappers/transfer.mapper";

const TRANSFER_IDEMPOTENCY_STATUS = 201;
const MAX_DEADLOCK_RETRIES = 3;

@Injectable()
export class TransfersService {
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

  async transfer(request: TransferRequest): Promise<TransferResponseDto> {
    this.validateRequestShape(request);

    let amount: Decimal;
    try {
      amount = parseAndValidateAmount(request.amount);
    } catch (error) {
      throw invalidRequest(
        error instanceof Error ? error.message : "Invalid amount",
      );
    }

    if (request.fromAccountId === request.toAccountId) {
      await this.writeTransferFailureAudit(request, sameAccountTransfer());
      throw sameAccountTransfer();
    }

    const cached = await this.idempotencyReplay.findCached(
      request.idempotencyKey,
    );
    if (cached) {
      return mapTransferResultToDto(
        this.idempotencyReplay.replayTransfer(cached, request),
      );
    }

    for (let attempt = 0; attempt < MAX_DEADLOCK_RETRIES; attempt++) {
      try {
        const result = await this.executeTransfer(request, amount);
        return mapTransferResultToDto(result);
      } catch (error) {
        if (isDeadlock(error) && attempt < MAX_DEADLOCK_RETRIES - 1) {
          continue;
        }

        const raced = await this.resolveIdempotencyRace(request, error);
        if (raced) {
          return mapTransferResultToDto(raced);
        }

        if (isDomainError(error)) {
          await this.writeTransferFailureAudit(request, error, amount);
        }
        throw error;
      }
    }

    throw new Error("Transfer failed after deadlock retries");
  }

  private async executeTransfer(
    request: TransferRequest,
    amount: Decimal,
  ): Promise<TransferResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.transactionRepository.findByIdempotencyKey(
        tx,
        request.idempotencyKey,
      );
      if (existing) {
        return this.buildResultFromTransaction(tx, existing, true);
      }

      const lockedAccounts = await this.accountRepository.lockAccountsForUpdate(
        tx,
        request.fromAccountId,
        request.toAccountId,
      );

      const source = lockedAccounts.get(request.fromAccountId);
      const destination = lockedAccounts.get(request.toAccountId);

      if (!source) {
        throw accountNotFound(request.fromAccountId);
      }
      if (!destination) {
        throw accountNotFound(request.toAccountId);
      }
      if (source.status === "closed") {
        throw accountClosed(request.fromAccountId);
      }
      if (destination.status === "closed") {
        throw accountClosed(request.toAccountId);
      }
      if (source.balance.lt(amount)) {
        throw insufficientFunds(
          formatMoney(source.balance),
          formatMoney(amount),
        );
      }

      const prismaAmount = toPrismaDecimal(amount);

      await this.accountRepository.debitBalance(
        tx,
        request.fromAccountId,
        prismaAmount,
      );
      await this.accountRepository.creditBalance(
        tx,
        request.toAccountId,
        prismaAmount,
      );

      const transaction = await this.transactionRepository.createCompletedTransfer(
        tx,
        {
          fromAccountId: request.fromAccountId,
          toAccountId: request.toAccountId,
          amount,
          idempotencyKey: request.idempotencyKey,
        },
      );

      await this.ledgerRepository.createTransferEntries(tx, {
        transactionId: transaction.id,
        fromAccountId: request.fromAccountId,
        toAccountId: request.toAccountId,
        amount,
      });

      await this.auditRepository.createInTransaction(tx, {
        operationType: "TRANSFER",
        outcome: "success",
        requestId: request.requestId,
        fromAccountId: request.fromAccountId,
        toAccountId: request.toAccountId,
        amount,
        transactionId: transaction.id,
        idempotencyKey: request.idempotencyKey,
        payload: {
          fromAccountId: request.fromAccountId,
          toAccountId: request.toAccountId,
          amount: formatMoney(amount),
        },
      });

      const result = await this.buildResultFromTransaction(
        tx,
        transaction,
        false,
      );

      await this.idempotencyRepository.saveInTransaction(tx, {
        key: request.idempotencyKey,
        operation: "transfer",
        responseStatus: TRANSFER_IDEMPOTENCY_STATUS,
        responseBody: JSON.parse(
          JSON.stringify(result),
        ) as Prisma.InputJsonValue,
      });

      return result;
    });
  }

  private async resolveIdempotencyRace(
    request: TransferRequest,
    error: unknown,
  ): Promise<TransferResult | null> {
    if (!isPrismaUniqueViolation(error)) {
      return null;
    }

    const existing = await this.transactionRepository.findByIdempotencyKey(
      this.prisma,
      request.idempotencyKey,
    );
    if (existing) {
      return this.buildResultFromTransaction(this.prisma, existing, true);
    }

    const cachedRetry = await this.idempotencyReplay.findCached(
      request.idempotencyKey,
    );
    if (cachedRetry) {
      return this.idempotencyReplay.replayTransfer(cachedRetry, request);
    }

    return null;
  }

  private validateRequestShape(request: TransferRequest): void {
    if (!request.idempotencyKey?.trim()) {
      throw invalidRequest("Idempotency-Key is required");
    }
    if (!request.requestId?.trim()) {
      throw invalidRequest("Request ID is required");
    }
    if (!request.fromAccountId?.trim() || !request.toAccountId?.trim()) {
      throw invalidRequest("fromAccountId and toAccountId are required");
    }
  }

  private async buildResultFromTransaction(
    tx: DbClient,
    transaction: Transaction,
    idempotentReplay: boolean,
  ): Promise<TransferResult> {
    const movement = mapMoneyMovement(transaction);

    if (!transaction.fromAccountId || !transaction.toAccountId) {
      throw new Error("Transfer transaction is missing account references");
    }

    const [fromBalance, toBalance] = await Promise.all([
      this.accountRepository.getBalance(tx, transaction.fromAccountId),
      this.accountRepository.getBalance(tx, transaction.toAccountId),
    ]);

    return {
      transaction: movement,
      balances: {
        fromAccountId: transaction.fromAccountId,
        fromBalance: formatMoney(toDecimal(fromBalance)),
        toAccountId: transaction.toAccountId,
        toBalance: formatMoney(toDecimal(toBalance)),
      },
      idempotentReplay,
    };
  }

  private writeTransferFailureAudit(
    request: TransferRequest,
    error: DomainError,
    amount?: Decimal,
  ): Promise<void> {
    return this.auditWriter.writeFailure(
      {
        operationType: "TRANSFER",
        outcome: "failure",
        requestId: request.requestId,
        fromAccountId: request.fromAccountId,
        toAccountId: request.toAccountId,
        amount: amount ?? null,
        idempotencyKey: request.idempotencyKey,
        errorCode: error.code,
        errorMessage: error.message,
        payload: {
          fromAccountId: request.fromAccountId,
          toAccountId: request.toAccountId,
          amount: request.amount,
        },
      },
      "transfer failure",
    );
  }
}
