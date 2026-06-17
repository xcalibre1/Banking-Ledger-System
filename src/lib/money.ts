import { Decimal } from "decimal.js";
import { Prisma } from "@prisma/client";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = string | number | Prisma.Decimal | Decimal;

export function toDecimal(value: MoneyInput): Decimal {
  return new Decimal(value.toString());
}

export function toPrismaDecimal(value: Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(4));
}

export function formatMoney(value: Decimal): string {
  return value.toFixed(2);
}

export function parseAndValidateAmount(raw: string): Decimal {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) {
    throw new Error("Amount must be a positive number with up to 4 decimal places");
  }

  const amount = toDecimal(trimmed);
  if (amount.lte(0)) {
    throw new Error("Amount must be greater than zero");
  }

  return amount;
}

export function sortAccountIds(ids: [string, string]): [string, string] {
  return ids[0] < ids[1] ? [ids[0], ids[1]] : [ids[1], ids[0]];
}
