import type { Account } from "../types";

export function accountLabel(
  accounts: Account[],
  accountId: string | null,
  accountName?: string | null,
): string {
  if (accountName) {
    return accountName;
  }
  if (!accountId) {
    return "—";
  }
  return (
    accounts.find((account) => account.id === accountId)?.name ??
    accountId.slice(0, 8)
  );
}
