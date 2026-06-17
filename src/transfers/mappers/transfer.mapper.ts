import type { TransferResult } from "../../models/transfer";
import { mapMoneyMovementToDto } from "../../transactions/mappers/transaction.mapper";
import { TransferResponseDto } from "../dto/transfer-response.dto";

export function mapTransferResultToDto(
  result: TransferResult,
): TransferResponseDto {
  return {
    transaction: mapMoneyMovementToDto(result.transaction),
    balances: { ...result.balances },
    idempotentReplay: result.idempotentReplay,
  };
}
