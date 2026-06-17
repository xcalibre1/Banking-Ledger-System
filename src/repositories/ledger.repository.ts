import { Injectable } from "@nestjs/common";
import type { Decimal } from "decimal.js";
import { toPrismaDecimal } from "../lib/money";
import type { DbClient } from "../prisma/prisma.service";

@Injectable()
export class LedgerRepository {
  async createTransferEntries(
    tx: DbClient,
    params: {
      transactionId: string;
      fromAccountId: string;
      toAccountId: string;
      amount: Decimal;
    },
  ): Promise<void> {
    const prismaAmount = toPrismaDecimal(params.amount);

    await tx.ledgerEntry.createMany({
      data: [
        {
          transactionId: params.transactionId,
          accountId: params.fromAccountId,
          direction: "debit",
          amount: prismaAmount,
        },
        {
          transactionId: params.transactionId,
          accountId: params.toAccountId,
          direction: "credit",
          amount: prismaAmount,
        },
      ],
    });
  }

  async createReversalEntries(
    tx: DbClient,
    params: {
      transactionId: string;
      fromAccountId: string;
      toAccountId: string;
      amount: Decimal;
    },
  ): Promise<void> {
    const prismaAmount = toPrismaDecimal(params.amount);

    await tx.ledgerEntry.createMany({
      data: [
        {
          transactionId: params.transactionId,
          accountId: params.fromAccountId,
          direction: "credit",
          amount: prismaAmount,
        },
        {
          transactionId: params.transactionId,
          accountId: params.toAccountId,
          direction: "debit",
          amount: prismaAmount,
        },
      ],
    });
  }
}
