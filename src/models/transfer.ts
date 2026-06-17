import type { Decimal } from "decimal.js";
import type { MoneyMovement } from "./money-movement";

export interface TransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  idempotencyKey: string;
  requestId: string;
}

export interface TransferResult {
  transaction: MoneyMovement;
  balances: {
    fromAccountId: string;
    fromBalance: string;
    toAccountId: string;
    toBalance: string;
  };
  idempotentReplay: boolean;
}

export interface CreateTransferParams {
  fromAccountId: string;
  toAccountId: string;
  amount: Decimal;
  idempotencyKey: string;
  requestId: string;
}
