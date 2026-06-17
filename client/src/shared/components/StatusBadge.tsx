import {
  normalizeTransactionStatus,
  type TransactionStatusVariant,
} from "../constants/status";

interface StatusBadgeProps {
  status: string;
  kind?: "transaction" | "account";
}

const TRANSACTION_LABELS: Record<TransactionStatusVariant, string> = {
  completed: "Completed",
  reversed: "Reversed",
  failed: "Failed",
  pending: "Pending",
};

const ACCOUNT_LABELS = {
  active: "Active",
  closed: "Closed",
} as const;

function getBadgeClass(status: string, kind: StatusBadgeProps["kind"]): string {
  if (kind === "account") {
    return status.toLowerCase() === "active"
      ? "badge badge-active"
      : "badge badge-closed";
  }

  return `badge badge-${normalizeTransactionStatus(status)}`;
}

function getLabel(status: string, kind: StatusBadgeProps["kind"]): string {
  if (kind === "account") {
    const normalized = status.toLowerCase() as keyof typeof ACCOUNT_LABELS;
    return ACCOUNT_LABELS[normalized] ?? status;
  }

  const normalized = normalizeTransactionStatus(status);
  return TRANSACTION_LABELS[normalized];
}

export function StatusBadge({ status, kind = "transaction" }: StatusBadgeProps) {
  return (
    <span className={getBadgeClass(status, kind)}>
      <span className="badge-dot" aria-hidden="true" />
      {getLabel(status, kind)}
    </span>
  );
}
