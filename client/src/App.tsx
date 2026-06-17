import { AccountList } from "./features/accounts/components/AccountList";
import { CreateAccountForm } from "./features/accounts/components/CreateAccountForm";
import { TransactionHistory } from "./features/transactions/components/TransactionHistory";
import { TransferForm } from "./features/transfers/components/TransferForm";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <p className="app-header__eyebrow">Banking ledger</p>
        <h1>Ledger Banking</h1>
        <p>
          Transfer funds between accounts with concurrency-safe ledger
          operations, full audit trail, and idempotent reversals.
        </p>
      </header>

      <div className="layout">
        <AccountList />
        <CreateAccountForm />
        <TransferForm />
        <TransactionHistory />
      </div>
    </div>
  );
}
