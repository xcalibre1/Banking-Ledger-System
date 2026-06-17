import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Decimal } from "decimal.js";
import { toDecimal, toPrismaDecimal } from "../lib/money";
import { mapAccount } from "../models/mappers";
import type { Account, LockedAccount } from "../models/account";
import { DbClient, PrismaService } from "../prisma/prisma.service";

interface LockedAccountRow {
  id: string;
  balance: Prisma.Decimal;
  status: "active" | "closed";
}

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(db: DbClient = this.prisma): Promise<Account[]> {
    const accounts = await db.account.findMany({
      orderBy: { name: "asc" },
    });
    return accounts.map(mapAccount);
  }

  async create(
    tx: DbClient,
    params: { name: string; initialBalance: Decimal },
  ): Promise<Account> {
    const account = await tx.account.create({
      data: {
        name: params.name,
        balance: toPrismaDecimal(params.initialBalance),
      },
    });
    return mapAccount(account);
  }

  async lockAccountsForUpdate(
    tx: DbClient,
    accountIdA: string,
    accountIdB: string,
  ): Promise<Map<string, LockedAccount>> {
    const [firstId, secondId] =
      accountIdA < accountIdB ? [accountIdA, accountIdB] : [accountIdB, accountIdA];

    const locked = new Map<string, LockedAccount>();
    for (const accountId of [firstId, secondId]) {
      const rows = await tx.$queryRaw<LockedAccountRow[]>`
        SELECT id, balance, status
        FROM accounts
        WHERE id = ${accountId}::uuid
        FOR UPDATE
      `;
      const row = rows[0];
      if (row) {
        locked.set(row.id, {
          id: row.id,
          balance: toDecimal(row.balance),
          status: row.status,
        });
      }
    }

    return locked;
  }

  async debitBalance(
    tx: DbClient,
    accountId: string,
    amount: Prisma.Decimal,
  ): Promise<void> {
    const updated = await tx.account.updateMany({
      where: {
        id: accountId,
        balance: { gte: amount },
      },
      data: {
        balance: { decrement: amount },
      },
    });

    if (updated.count !== 1) {
      throw new Error(
        `Debit failed for account ${accountId}: insufficient funds or concurrent modification`,
      );
    }
  }

  async creditBalance(
    tx: DbClient,
    accountId: string,
    amount: Prisma.Decimal,
  ): Promise<void> {
    await tx.account.update({
      where: { id: accountId },
      data: {
        balance: { increment: amount },
      },
    });
  }

  async getBalance(tx: DbClient, accountId: string): Promise<Prisma.Decimal> {
    const account = await tx.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { balance: true },
    });
    return account.balance;
  }
}
