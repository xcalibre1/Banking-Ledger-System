export type TransactionStatusVariant =
  | "completed"
  | "reversed"
  | "pending"
  | "failed";

export type AccountStatusVariant = "active" | "closed";

const TRANSACTION_STATUSES: TransactionStatusVariant[] = [
  "completed",
  "reversed",
  "pending",
  "failed",
];

export function normalizeTransactionStatus(
  status: string,
): TransactionStatusVariant {
  const normalized = status.toLowerCase() as TransactionStatusVariant;
  return TRANSACTION_STATUSES.includes(normalized) ? normalized : "failed";
}

export function transactionItemClass(status: string): string {
  const variant = normalizeTransactionStatus(status);
  return `transaction-item transaction-item--${variant}`;
}
