export function formatMoney(amount: string): string {
  return `$${amount}`;
}

export function formatMoneyWithBalance(
  name: string,
  balance: string,
): string {
  return `${name} (${formatMoney(balance)})`;
}
