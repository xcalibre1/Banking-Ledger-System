import { Injectable } from "@nestjs/common";
import { Prisma, type Transaction } from "@prisma/client";
import type { Decimal } from "decimal.js";
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
  idempotencyConflict,
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
  ) {}

  async transfer(request: TransferRequest): Promise<TransferResult> {
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
      await this.auditFailure(request, sameAccountTransfer());
      throw sameAccountTransfer();
    }

    const cached = await this.idempotencyRepository.findByKey(
      request.idempotencyKey,
    );
    if (cached) {
      return this.handleIdempotentReplay(cached, request);
    }

    for (let attempt = 0; attempt < MAX_DEADLOCK_RETRIES; attempt++) {
      try {
        return await this.executeTransfer(request, amount);
      } catch (error) {
        if (this.isDeadlock(error) && attempt < MAX_DEADLOCK_RETRIES - 1) {
          continue;
        }

        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const existing = await this.transactionRepository.findByIdempotencyKey(
            this.prisma,
            request.idempotencyKey,
          );
          if (existing) {
            return this.buildResultFromTransaction(this.prisma, existing, true);
          }
          const cachedRetry = await this.idempotencyRepository.findByKey(
            request.idempotencyKey,
          );
          if (cachedRetry) {
            return this.handleIdempotentReplay(cachedRetry, request);
          }
        }

        if (isDomainError(error)) {
          await this.auditFailure(request, error, amount);
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

  private isDeadlock(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2010" &&
      (error.meta as { code?: string } | undefined)?.code === "40P01"
    );
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

  private async handleIdempotentReplay(
    cached: { operation: string; responseBody: unknown },
    request: TransferRequest,
  ): Promise<TransferResult> {
    if (cached.operation !== "transfer") {
      throw idempotencyConflict();
    }

    const body = cached.responseBody as TransferResult | null;
    if (!body?.transaction) {
      throw idempotencyConflict();
    }

    const sameBody =
      body.transaction.fromAccountId === request.fromAccountId &&
      body.transaction.toAccountId === request.toAccountId &&
      body.transaction.amount ===
        parseAndValidateAmount(request.amount).toFixed(2);

    if (!sameBody) {
      throw idempotencyConflict();
    }

    return { ...body, idempotentReplay: true };
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

  private async auditFailure(
    request: TransferRequest,
    error: DomainError,
    amount?: Decimal,
  ): Promise<void> {
    try {
      await this.auditRepository.createStandalone({
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
      });
    } catch (auditError) {
      console.error("Failed to write transfer failure audit event", auditError);
    }
  }
}
