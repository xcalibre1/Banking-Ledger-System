import { useState } from "react";
import { useGetAccountsQuery } from "@/features/accounts/api/accountsApi";
import { useCreateTransferMutation } from "@/features/transfers/api/transfersApi";
import { Alert } from "@/shared/components/Alert";
import { MESSAGES } from "@/shared/constants/messages";
import { formatMoney, formatMoneyWithBalance } from "@/shared/utils/formatMoney";
import { getErrorMessage } from "@/shared/utils/getErrorMessage";
import { newIdempotencyKey } from "@/shared/utils/idempotency";

export function TransferForm() {
  const { data } = useGetAccountsQuery();
  const accounts = data?.accounts ?? [];
  const activeAccounts = accounts.filter((account) => account.status === "active");

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [createTransfer, { isLoading, error }] = useCreateTransferMutation();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);

    try {
      const result = await createTransfer({
        fromAccountId,
        toAccountId,
        amount,
        idempotencyKey: newIdempotencyKey(),
      }).unwrap();

      const message = result.idempotentReplay
        ? MESSAGES.transferIdempotentReplay
        : `Transferred ${formatMoney(result.transaction.amount)} successfully.`;

      setSuccess(message);
      setAmount("");
    } catch {
      // RTK Query surfaces errors via `error` state.
    }
  }

  return (
    <section className="card">
      <h2>Transfer funds</h2>
      {activeAccounts.length < 2 ? (
        <p className="empty">Create at least two active accounts to transfer.</p>
      ) : (
        <form className="stack" onSubmit={(event) => void handleSubmit(event)}>
          <div className="field">
            <label htmlFor="from-account">From</label>
            <select
              id="from-account"
              value={fromAccountId}
              onChange={(event) => setFromAccountId(event.target.value)}
              required
            >
              <option value="">Select source account</option>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {formatMoneyWithBalance(account.name, account.balance)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="to-account">To</label>
            <select
              id="to-account"
              value={toAccountId}
              onChange={(event) => setToAccountId(event.target.value)}
              required
            >
              <option value="">Select destination account</option>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {formatMoneyWithBalance(account.name, account.balance)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="25.50"
              required
            />
          </div>
          {error && (
            <Alert
              variant="error"
              message={getErrorMessage(error, "Transfer failed")}
            />
          )}
          {success && <Alert variant="success" message={success} />}
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? "Transferring…" : "Transfer"}
          </button>
        </form>
      )}
    </section>
  );
}
