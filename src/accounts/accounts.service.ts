import { Injectable } from "@nestjs/common";
import { formatMoney, parseAndValidateAmount, toDecimal } from "../lib/money";
import { DomainError, invalidRequest } from "../models/errors";
import { AuditWriterService } from "../common/services/audit-writer.service";
import { mapAccountToResponse } from "./mappers/account.mapper";
import { AccountRepository } from "../repositories/account.repository";
import { AuditRepository } from "../repositories/audit.repository";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import {
  AccountResponseDto,
  AccountsListResponseDto,
} from "./dto/account-response.dto";

@Injectable()
export class AccountsService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly prisma: PrismaService,
    private readonly auditRepository: AuditRepository,
    private readonly auditWriter: AuditWriterService,
  ) {}

  async findAll(): Promise<AccountsListResponseDto> {
    const accounts = await this.accountRepository.listAll();
    return { accounts: accounts.map(mapAccountToResponse) };
  }

  async create(
    dto: CreateAccountDto,
    requestId: string,
  ): Promise<AccountResponseDto> {
    const name = dto.name?.trim();
    if (!name) {
      const error = invalidRequest("Account name is required");
      await this.writeCreateFailureAudit({
        requestId,
        error,
        name: dto.name,
        initialBalance: dto.initialBalance,
      });
      throw error;
    }

    let initialBalance;
    try {
      initialBalance = dto.initialBalance
        ? parseAndValidateAmount(dto.initialBalance)
        : toDecimal(0);
    } catch (parseError) {
      const error = invalidRequest(
        parseError instanceof Error ? parseError.message : "Invalid initial balance",
      );
      await this.writeCreateFailureAudit({
        requestId,
        error,
        name,
        initialBalance: dto.initialBalance,
      });
      throw error;
    }

    if (initialBalance.isNegative()) {
      const error = invalidRequest("Initial balance cannot be negative");
      await this.writeCreateFailureAudit({
        requestId,
        error,
        name,
        amount: initialBalance,
      });
      throw error;
    }

    const account = await this.prisma.$transaction(async (tx) => {
      const created = await this.accountRepository.create(tx, {
        name,
        initialBalance,
      });

      await this.auditRepository.createInTransaction(tx, {
        operationType: "CREATE_ACCOUNT",
        outcome: "success",
        requestId,
        toAccountId: created.id,
        amount: initialBalance,
        payload: {
          name: created.name,
          initialBalance: formatMoney(initialBalance),
        },
      });

      return created;
    });

    return mapAccountToResponse(account);
  }

  private writeCreateFailureAudit(params: {
    requestId: string;
    error: DomainError;
    name?: string;
    initialBalance?: string;
    amount?: import("decimal.js").Decimal;
  }): Promise<void> {
    return this.auditWriter.writeFailure(
      {
        operationType: "CREATE_ACCOUNT",
        outcome: "failure",
        requestId: params.requestId,
        amount: params.amount ?? null,
        errorCode: params.error.code,
        errorMessage: params.error.message,
        payload: {
          name: params.name ?? null,
          initialBalance: params.initialBalance ?? null,
        },
      },
      "account creation failure",
    );
  }
}
