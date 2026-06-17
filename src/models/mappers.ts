import type { Transaction } from "@prisma/client";
import { toDecimal } from "../lib/money";
import type { Account } from "./account";
import type { MoneyMovement } from "./money-movement";

export function mapAccount(record: import("@prisma/client").Account): Account {
  return {
    id: record.id,
    name: record.name,
    balance: toDecimal(record.balance),
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function mapMoneyMovement(record: Transaction): MoneyMovement {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    fromAccountId: record.fromAccountId,
    toAccountId: record.toAccountId,
    amount: toDecimal(record.amount).toFixed(2),
    idempotencyKey: record.idempotencyKey,
    reversesTransactionId: record.reversesTransactionId,
    createdAt: record.createdAt,
    completedAt: record.completedAt,
  };
}
