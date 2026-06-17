import { Injectable } from "@nestjs/common";
import type { Transaction } from "@prisma/client";
import type { Decimal } from "decimal.js";
import type { DbClient } from "../prisma/prisma.service";
import { PrismaService } from "../prisma/prisma.service";
import { toPrismaDecimal } from "../lib/money";

interface LockedTransactionRow {
  id: string;
  type: string;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: import("@prisma/client").Prisma.Decimal;
  status: string;
  idempotency_key: string | null;
  reverses_transaction_id: string | null;
  failure_reason: string | null;
  created_at: Date;
  completed_at: Date | null;
}

function mapLockedRow(row: LockedTransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type as Transaction["type"],
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amount: row.amount,
    status: row.status as Transaction["status"],
    idempotencyKey: row.idempotency_key,
    reversesTransactionId: row.reverses_transaction_id,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    tx: DbClient,
    transactionId: string,
  ): Promise<Transaction | null> {
    return tx.transaction.findUnique({
      where: { id: transactionId },
    });
  }

  async findByIdempotencyKey(
    tx: DbClient,
    idempotencyKey: string,
  ): Promise<Transaction | null> {
    return tx.transaction.findUnique({
      where: { idempotencyKey },
    });
  }

  async findReversalForOriginal(
    tx: DbClient,
    originalTransactionId: string,
  ): Promise<Transaction | null> {
    return tx.transaction.findUnique({
      where: { reversesTransactionId: originalTransactionId },
    });
  }

  async lockTransactionForUpdate(
    tx: DbClient,
    transactionId: string,
  ): Promise<Transaction | null> {
    const rows = await tx.$queryRaw<LockedTransactionRow[]>`
      SELECT
        id,
        type,
        from_account_id,
        to_account_id,
        amount,
        status,
        idempotency_key,
        reverses_transaction_id,
        failure_reason,
        created_at,
        completed_at
      FROM transactions
      WHERE id = ${transactionId}::uuid
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? mapLockedRow(row) : null;
  }

  async listRecent(
    db: DbClient = this.prisma,
    limit = 50,
  ): Promise<Transaction[]> {
    return db.transaction.findMany({
      where: { type: "transfer" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async createCompletedTransfer(
    tx: DbClient,
    params: {
      fromAccountId: string;
      toAccountId: string;
      amount: Decimal;
      idempotencyKey: string;
    },
  ): Promise<Transaction> {
    const now = new Date();

    return tx.transaction.create({
      data: {
        type: "transfer",
        fromAccountId: params.fromAccountId,
        toAccountId: params.toAccountId,
        amount: toPrismaDecimal(params.amount),
        status: "completed",
        idempotencyKey: params.idempotencyKey,
        completedAt: now,
      },
    });
  }

  async createCompletedReversal(
    tx: DbClient,
    params: {
      fromAccountId: string;
      toAccountId: string;
      amount: Decimal;
      originalTransactionId: string;
      idempotencyKey: string;
    },
  ): Promise<Transaction> { 
    const now = new Date();

    return tx.transaction.create({
      data: {
        type: "reversal",
        fromAccountId: params.fromAccountId,
        toAccountId: params.toAccountId,
        amount: toPrismaDecimal(params.amount),
        status: "completed",
        idempotencyKey: params.idempotencyKey,
        reversesTransactionId: params.originalTransactionId,
        completedAt: now,
      },
    });
  }

  async markReversed(tx: DbClient, transactionId: string): Promise<void> {
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "reversed" },
    });
  }
}
