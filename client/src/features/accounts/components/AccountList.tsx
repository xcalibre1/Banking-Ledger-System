import { useGetAccountsQuery } from "../api/accountsApi";
import { Alert } from "../../../shared/components/Alert";
import { StatusBadge } from "../../../shared/components/StatusBadge";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Failed to load accounts";
}

export function AccountList() {
  const { data, isLoading, isFetching, error, refetch } = useGetAccountsQuery();
  const accounts = data?.accounts ?? [];

  return (
    <section className="card">
      <div className="toolbar">
        <h2>Accounts</h2>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          Refresh
        </button>
      </div>

      {error && <Alert variant="error" message={getErrorMessage(error)} />}

      {isLoading ? (
        <p className="empty">Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <p className="empty">No accounts yet. Create one to get started.</p>
      ) : (
        <ul className="account-list">
          {accounts.map((account) => (
            <li key={account.id} className="account-item">
              <div className="account-item__info">
                <strong>{account.name}</strong>
                <StatusBadge status={account.status} kind="account" />
              </div>
              <div className="balance">${account.balance}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
