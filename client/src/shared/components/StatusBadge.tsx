interface StatusBadgeProps {
  status: string;
  kind?: "transaction" | "account";
}

const TRANSACTION_LABELS: Record<string, string> = {
  completed: "Completed",
  reversed: "Reversed",
  failed: "Failed",
  pending: "Pending",
};

const ACCOUNT_LABELS: Record<string, string> = {
  active: "Active",
  closed: "Closed",
};

function getBadgeClass(status: string, kind: StatusBadgeProps["kind"]): string {
  const normalized = status.toLowerCase();

  if (kind === "account") {
    return normalized === "active" ? "badge badge-active" : "badge badge-closed";
  }

  switch (normalized) {
    case "completed":
      return "badge badge-completed";
    case "reversed":
      return "badge badge-reversed";
    case "pending":
      return "badge badge-pending";
    case "failed":
      return "badge badge-failed";
    default:
      return "badge badge-neutral";
  }
}

function getLabel(status: string, kind: StatusBadgeProps["kind"]): string {
  const normalized = status.toLowerCase();
  const labels = kind === "account" ? ACCOUNT_LABELS : TRANSACTION_LABELS;
  return labels[normalized] ?? status;
}

export function StatusBadge({ status, kind = "transaction" }: StatusBadgeProps) {
  return (
    <span className={getBadgeClass(status, kind)}>
      <span className="badge-dot" aria-hidden="true" />
      {getLabel(status, kind)}
    </span>
  );
}
