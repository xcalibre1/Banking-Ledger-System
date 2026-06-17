import { useState } from "react";
import { useGetAccountsQuery } from "../../accounts/api/accountsApi";
import {
  useGetTransactionsQuery,
  useReverseTransactionMutation,
} from "../api/transactionsApi";
import { Alert } from "../../../shared/components/Alert";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { accountLabel } from "../../../shared/utils/accountLabel";
import { newIdempotencyKey } from "../../../shared/utils/idempotency";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Request failed";
}

function transactionItemClass(status: string): string {
  const normalized = status.toLowerCase();
  const allowed = ["completed", "reversed", "failed", "pending"];
  const variant = allowed.includes(normalized) ? normalized : "failed";
  return `transaction-item transaction-item--${variant}`;
}

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
        ? "Reversal already applied (idempotent replay)."
        : `Reversed transfer of $${result.originalTransaction.amount}.`;
      setSuccess(message);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setReversingId(null);
    }
  }

  return (
    <section className="card layout-wide">
      <div className="toolbar">
        <h2>Recent transfers</h2>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          Refresh
        </button>
      </div>

      {loadError && (
        <Alert variant="error" message={getErrorMessage(loadError)} />
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
                    ${transaction.amount}
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
