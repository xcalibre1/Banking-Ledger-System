export type ErrorCode =
  | "INVALID_REQUEST"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_CLOSED"
  | "INSUFFICIENT_FUNDS"
  | "IDEMPOTENCY_CONFLICT"
  | "SAME_ACCOUNT_TRANSFER"
  | "TRANSACTION_NOT_FOUND"
  | "ALREADY_REVERSED"
  | "NOT_REVERSIBLE";

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;

  constructor(code: ErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function invalidRequest(message: string): DomainError {
  return new DomainError("INVALID_REQUEST", message, 400);
}

export function accountNotFound(accountId: string): DomainError {
  return new DomainError(
    "ACCOUNT_NOT_FOUND",
    `Account not found: ${accountId}`,
    404,
  );
}

export function accountClosed(accountId: string): DomainError {
  return new DomainError(
    "ACCOUNT_CLOSED",
    `Account is closed: ${accountId}`,
    409,
  );
}

export function insufficientFunds(
  available: string,
  requested: string,
): DomainError {
  return new DomainError(
    "INSUFFICIENT_FUNDS",
    `Source account balance ${available} is less than transfer amount ${requested}`,
    409,
  );
}

export function sameAccountTransfer(): DomainError {
  return new DomainError(
    "SAME_ACCOUNT_TRANSFER",
    "Source and destination accounts must be different",
    400,
  );
}

export function idempotencyConflict(): DomainError {
  return new DomainError(
    "IDEMPOTENCY_CONFLICT",
    "Idempotency key was already used with a different request body",
    409,
  );
}

export function transactionNotFound(transactionId: string): DomainError {
  return new DomainError(
    "TRANSACTION_NOT_FOUND",
    `Transaction not found: ${transactionId}`,
    404,
  );
}

export function alreadyReversed(transactionId: string): DomainError {
  return new DomainError(
    "ALREADY_REVERSED",
    `Transaction already reversed: ${transactionId}`,
    409,
  );
}

export function notReversible(reason: string): DomainError {
  return new DomainError("NOT_REVERSIBLE", reason, 409);
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
