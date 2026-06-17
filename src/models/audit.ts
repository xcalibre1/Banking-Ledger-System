import type { AuditOutcome } from "@prisma/client";
import type { Decimal } from "decimal.js";

export type AuditOperationType =
  | "TRANSFER"
  | "REVERSE"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "CREATE_ACCOUNT";

export interface AuditEventInput {
  operationType: AuditOperationType;
  outcome: AuditOutcome;
  requestId: string;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  amount?: Decimal | null;
  transactionId?: string | null;
  idempotencyKey?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  payload?: Record<string, unknown> | null;
}
