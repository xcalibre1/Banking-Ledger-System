import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { toPrismaDecimal } from "../lib/money";
import type { AuditEventInput } from "../models/audit";
import type { DbClient } from "../prisma/prisma.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createInTransaction(
    tx: DbClient,
    event: AuditEventInput,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: this.toCreateData(event),
    });
  }

  async createStandalone(event: AuditEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: this.toCreateData(event),
    });
  }

  private toCreateData(event: AuditEventInput) {
    return {
      operationType: event.operationType,
      outcome: event.outcome,
      requestId: event.requestId,
      fromAccountId: event.fromAccountId ?? null,
      toAccountId: event.toAccountId ?? null,
      amount:
        event.amount != null ? toPrismaDecimal(event.amount) : null,
      transactionId: event.transactionId ?? null,
      idempotencyKey: event.idempotencyKey ?? null,
      errorCode: event.errorCode ?? null,
      errorMessage: event.errorMessage ?? null,
      payload: (event.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    };
  }
}
