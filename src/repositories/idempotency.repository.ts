import { Injectable } from "@nestjs/common";
import type { IdempotencyOperation, Prisma } from "@prisma/client";
import type { DbClient } from "../prisma/prisma.service";
import { PrismaService } from "../prisma/prisma.service";

export interface StoredIdempotencyRecord {
  key: string;
  operation: IdempotencyOperation;
  responseStatus: number;
  responseBody: Prisma.JsonValue;
}

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByKey(key: string): Promise<StoredIdempotencyRecord | null> {
    return this.prisma.idempotencyKey.findUnique({
      where: { key },
    });
  }

  async saveInTransaction(
    tx: DbClient,
    record: {
      key: string;
      operation: IdempotencyOperation;
      responseStatus: number;
      responseBody: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await tx.idempotencyKey.create({
      data: record,
    });
  }
}
