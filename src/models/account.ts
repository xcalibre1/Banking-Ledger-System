import type { AccountStatus } from "@prisma/client";
import type { Decimal } from "decimal.js";

export interface Account {
  id: string;
  name: string;
  balance: Decimal;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface LockedAccount {
  id: string;
  balance: Decimal;
  status: AccountStatus;
}
