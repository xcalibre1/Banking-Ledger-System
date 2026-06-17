import { useGetAccountsQuery } from "@/features/accounts/api/accountsApi";
import { Alert } from "@/shared/components/Alert";
import { CardToolbar } from "@/shared/components/CardToolbar";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatMoney } from "@/shared/utils/formatMoney";
import { getErrorMessage } from "@/shared/utils/getErrorMessage";

export function AccountList() {
  const { data, isLoading, isFetching, error, refetch } = useGetAccountsQuery();
  const accounts = data?.accounts ?? [];

  return (
    <section className="card">
      <CardToolbar
        title="Accounts"
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
      />

      {error && (
        <Alert
          variant="error"
          message={getErrorMessage(error, "Failed to load accounts")}
        />
      )}

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
              <div className="balance">{formatMoney(account.balance)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
