import { Injectable } from "@nestjs/common";
import { formatMoney, parseAndValidateAmount, toDecimal } from "../lib/money";
import {
  DomainError,
  invalidRequest,
} from "../models/errors";
import type { Account } from "../models/account";
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
  ) {}

  async findAll(): Promise<AccountsListResponseDto> {
    const accounts = await this.accountRepository.listAll();
    return { accounts: accounts.map((account) => this.toResponse(account)) };
  }

  async create(
    dto: CreateAccountDto,
    requestId: string,
  ): Promise<AccountResponseDto> {
    const name = dto.name?.trim();
    if (!name) {
      const error = invalidRequest("Account name is required");
      await this.auditFailure({
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
      await this.auditFailure({
        requestId,
        error,
        name,
        initialBalance: dto.initialBalance,
      });
      throw error;
    }

    if (initialBalance.isNegative()) {
      const error = invalidRequest("Initial balance cannot be negative");
      await this.auditFailure({
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

    return this.toResponse(account);
  }

  private toResponse(account: Account): AccountResponseDto {
    return {
      id: account.id,
      name: account.name,
      balance: account.balance.toFixed(2),
      status: account.status,
    };
  }

  private async auditFailure(params: {
    requestId: string;
    error: DomainError;
    name?: string;
    initialBalance?: string;
    amount?: import("decimal.js").Decimal;
  }): Promise<void> {
    try {
      await this.auditRepository.createStandalone({
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
      });
    } catch (auditError) {
      console.error("Failed to write account creation failure audit event", auditError);
    }
  }
}
