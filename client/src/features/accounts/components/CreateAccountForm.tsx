import { useState } from "react";
import { useCreateAccountMutation } from "../api/accountsApi";
import { Alert } from "../../../shared/components/Alert";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Failed to create account";
}

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
      setSuccess(`Created account "${account.name}" with $${account.balance}`);
      setName("");
      setInitialBalance("100.00");
    } catch {
      // Error surfaced via RTK Query `error` state.
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
        {error && <Alert variant="error" message={getErrorMessage(error)} />}
        {success && <Alert variant="success" message={success} />}
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? "Creating…" : "Create account"}
        </button>
      </form>
    </section>
  );
}
