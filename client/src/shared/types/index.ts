export interface Account {
  id: string;
  name: string;
  balance: string;
  status: "active" | "closed";
}

export interface AccountsListResponse {
  accounts: Account[];
}

export interface CreateAccountRequest {
  name: string;
  initialBalance?: string;
}

export interface MoneyMovement {
  id: string;
  type: string;
  status: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  fromAccountName?: string | null;
  toAccountName?: string | null;
  amount: string;
  idempotencyKey: string | null;
  reversesTransactionId?: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TransactionListResponse {
  transactions: MoneyMovement[];
}

export interface TransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  idempotencyKey: string;
}

export interface TransferResult {
  transaction: MoneyMovement;
  balances: {
    fromAccountId: string;
    fromBalance: string;
    toAccountId: string;
    toBalance: string;
  };
  idempotentReplay: boolean;
}

export interface ReverseResult {
  reversal: MoneyMovement;
  originalTransaction: MoneyMovement;
  idempotentReplay: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
