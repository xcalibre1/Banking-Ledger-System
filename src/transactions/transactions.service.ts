import { Injectable } from "@nestjs/common";
import { mapMoneyMovement } from "../models/mappers";
import { AccountRepository } from "../repositories/account.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import { TransactionListResponseDto } from "./dto/transaction-response.dto";

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async findRecent(): Promise<TransactionListResponseDto> {
    const [records, accountList] = await Promise.all([
      this.transactionRepository.listRecent(),
      this.accountRepository.listAll(),
    ]);

    const nameById = new Map(
      accountList.map((account) => [account.id, account.name]),
    );

    return {
      transactions: records.map((record) => ({
        ...mapMoneyMovement(record),
        fromAccountName: record.fromAccountId
          ? (nameById.get(record.fromAccountId) ?? null)
          : null,
        toAccountName: record.toAccountId
          ? (nameById.get(record.toAccountId) ?? null)
          : null,
      })),
    };
  }
}
