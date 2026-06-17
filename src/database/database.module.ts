import { Module } from "@nestjs/common";
import { AccountRepository } from "../repositories/account.repository";
import { AuditRepository } from "../repositories/audit.repository";
import { IdempotencyRepository } from "../repositories/idempotency.repository";
import { LedgerRepository } from "../repositories/ledger.repository";
import { TransactionRepository } from "../repositories/transaction.repository";

const repositories = [
  AccountRepository,
  TransactionRepository,
  LedgerRepository,
  AuditRepository,
  IdempotencyRepository,
];

@Module({
  providers: [...repositories],
  exports: [...repositories],
})
export class DatabaseModule {}
