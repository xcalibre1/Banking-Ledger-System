import type { Response } from "express";
import { invalidRequest } from "../../models/errors";

export function requireIdempotencyKey(key: string | undefined): string {
  if (!key?.trim()) {
    throw invalidRequest("Idempotency-Key is required");
  }
  return key;
}

export function setCreatedUnlessIdempotentReplay(
  res: Response,
  idempotentReplay: boolean,
): void {
  if (!idempotentReplay) {
    res.status(201);
  }
}
