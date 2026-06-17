import { useState } from "react";
import { useCreateAccountMutation } from "@/features/accounts/api/accountsApi";
import { Alert } from "@/shared/components/Alert";
import { formatMoney } from "@/shared/utils/formatMoney";
import { getErrorMessage } from "@/shared/utils/getErrorMessage";

export function CreateAccountForm() {
  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState("100.00");
  const [success, setSuccess] = useState<string | null>(null);
  const [createAccount, { isLoading, error }] = useCreateAccountMutation();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);

    try {
      const account = await createAccount({
        name,
        initialBalance: initialBalance || undefined,
      }).unwrap();

      setSuccess(
        `Created account "${account.name}" with ${formatMoney(account.balance)}`,
      );
      setName("");
      setInitialBalance("100.00");
    } catch {
      // RTK Query surfaces errors via `error` state.
    }
  }

  return (
    <section className="card">
      <h2>Create account</h2>
      <form className="stack" onSubmit={(event) => void handleSubmit(event)}>
        <div className="field">
          <label htmlFor="account-name">Name</label>
          <input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alice"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="initial-balance">Initial balance</label>
          <input
            id="initial-balance"
            value={initialBalance}
            onChange={(event) => setInitialBalance(event.target.value)}
            placeholder="100.00"
          />
        </div>
        {error && (
          <Alert
            variant="error"
            message={getErrorMessage(error, "Failed to create account")}
          />
        )}
        {success && <Alert variant="success" message={success} />}
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? "Creating…" : "Create account"}
        </button>
      </form>
    </section>
  );
}
