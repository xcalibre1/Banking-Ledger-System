import { Injectable } from "@nestjs/common";
import { parseAndValidateAmount } from "../../lib/money";
import { idempotencyConflict } from "../../models/errors";
import type { ReverseResult } from "../../models/money-movement";
import type { TransferRequest, TransferResult } from "../../models/transfer";
import {
  IdempotencyRepository,
  type StoredIdempotencyRecord,
} from "../../repositories/idempotency.repository";

@Injectable()
export class IdempotencyReplayService {
  constructor(
    private readonly idempotencyRepository: IdempotencyRepository,
  ) {}

  findCached(key: string): Promise<StoredIdempotencyRecord | null> {
    return this.idempotencyRepository.findByKey(key);
  }

  replayTransfer(
    cached: StoredIdempotencyRecord,
    request: TransferRequest,
  ): TransferResult {
    if (cached.operation !== "transfer") {
      throw idempotencyConflict();
    }

    const body = cached.responseBody as TransferResult | null;
    if (!body?.transaction) {
      throw idempotencyConflict();
    }

    const sameBody =
      body.transaction.fromAccountId === request.fromAccountId &&
      body.transaction.toAccountId === request.toAccountId &&
      body.transaction.amount ===
        parseAndValidateAmount(request.amount).toFixed(2);

    if (!sameBody) {
      throw idempotencyConflict();
    }

    return { ...body, idempotentReplay: true };
  }

  replayReverse(
    cached: StoredIdempotencyRecord,
    transactionId: string,
  ): ReverseResult {
    if (cached.operation !== "reverse") {
      throw idempotencyConflict();
    }

    const body = cached.responseBody as ReverseResult | null;
    if (!body?.reversal || !body.originalTransaction) {
      throw idempotencyConflict();
    }

    if (body.originalTransaction.id !== transactionId) {
      throw idempotencyConflict();
    }

    return { ...body, idempotentReplay: true };
  }
}
