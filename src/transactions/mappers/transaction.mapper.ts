import type { MoneyMovement } from "../../models/money-movement";
import { TransactionResponseDto } from "../dto/transaction-response.dto";

export function mapMoneyMovementToDto(
  movement: MoneyMovement,
): TransactionResponseDto {
  return {
    id: movement.id,
    type: movement.type,
    status: movement.status,
    fromAccountId: movement.fromAccountId,
    toAccountId: movement.toAccountId,
    fromAccountName: null,
    toAccountName: null,
    amount: movement.amount,
    idempotencyKey: movement.idempotencyKey,
    reversesTransactionId: movement.reversesTransactionId ?? null,
    createdAt: movement.createdAt,
    completedAt: movement.completedAt,
  };
}
