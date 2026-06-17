import { useState } from "react";
import { useGetAccountsQuery } from "@/features/accounts/api/accountsApi";
import {
  useGetTransactionsQuery,
  useReverseTransactionMutation,
} from "@/features/transactions/api/transactionsApi";
import { Alert } from "@/shared/components/Alert";
import { CardToolbar } from "@/shared/components/CardToolbar";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { MESSAGES } from "@/shared/constants/messages";
import { transactionItemClass } from "@/shared/constants/status";
import { accountLabel } from "@/shared/utils/accountLabel";
import { formatMoney } from "@/shared/utils/formatMoney";
import { getErrorMessage } from "@/shared/utils/getErrorMessage";
import { newIdempotencyKey } from "@/shared/utils/idempotency";

export function TransactionHistory() {
  const { data: accountsData } = useGetAccountsQuery();
  const accounts = accountsData?.accounts ?? [];

  const {
    data,
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useGetTransactionsQuery();
  const transactions = data?.transactions ?? [];

  const [reversingId, setReversingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reverseTransaction] = useReverseTransactionMutation();

  async function handleReverse(transactionId: string) {
    setReversingId(transactionId);
    setActionError(null);
    setSuccess(null);

    try {
      const result = await reverseTransaction({
        transactionId,
        idempotencyKey: newIdempotencyKey(),
      }).unwrap();

      const message = result.idempotentReplay
        ? MESSAGES.reversalIdempotentReplay
        : `Reversed transfer of ${formatMoney(result.originalTransaction.amount)}.`;

      setSuccess(message);
    } catch (error) {
      setActionError(getErrorMessage(error, "Reversal failed"));
    } finally {
      setReversingId(null);
    }
  }

  return (
    <section className="card layout-wide">
      <CardToolbar
        title="Recent transfers"
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
      />

      {loadError && (
        <Alert
          variant="error"
          message={getErrorMessage(loadError, "Failed to load transactions")}
        />
      )}
      {actionError && <Alert variant="error" message={actionError} />}
      {success && <Alert variant="success" message={success} />}

      {isLoading ? (
        <p className="empty">Loading transactions…</p>
      ) : transactions.length === 0 ? (
        <p className="empty">No transfers yet.</p>
      ) : (
        <div className="transaction-list">
          {transactions.map((transaction) => (
            <article
              key={transaction.id}
              className={transactionItemClass(transaction.status)}
            >
              <div className="transaction-main">
                <div className="transaction-details">
                  <div className="transaction-amount">
                    {formatMoney(transaction.amount)}
                  </div>
                  <div className="transaction-route">
                    <span>
                      {accountLabel(
                        accounts,
                        transaction.fromAccountId,
                        transaction.fromAccountName,
                      )}
                    </span>
                    <span className="transaction-route__arrow" aria-hidden="true">
                      →
                    </span>
                    <span>
                      {accountLabel(
                        accounts,
                        transaction.toAccountId,
                        transaction.toAccountName,
                      )}
                    </span>
                  </div>
                </div>
                <StatusBadge status={transaction.status} />
              </div>
              <div className="transaction-footer">
                <time
                  className="transaction-date"
                  dateTime={transaction.createdAt}
                >
                  {new Date(transaction.createdAt).toLocaleString()}
                </time>
                {transaction.status === "completed" && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={reversingId === transaction.id}
                    onClick={() => void handleReverse(transaction.id)}
                  >
                    {reversingId === transaction.id ? "Reversing…" : "Reverse"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
