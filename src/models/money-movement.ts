import type { TransactionStatus, TransactionType } from "@prisma/client";

export interface MoneyMovement {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  fromAccountId: string | null;
  toAccountId: string | null;
  amount: string;
  idempotencyKey: string | null;
  reversesTransactionId?: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface ReverseRequest {
  transactionId: string;
  idempotencyKey: string;
  requestId: string;
}

export interface ReverseResult {
  reversal: MoneyMovement;
  originalTransaction: MoneyMovement;
  idempotentReplay: boolean;
}
