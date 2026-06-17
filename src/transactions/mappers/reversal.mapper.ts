import type { ReverseResult } from "../../models/money-movement";
import { ReverseResponseDto } from "../dto/reverse-response.dto";
import { mapMoneyMovementToDto } from "./transaction.mapper";

export function mapReverseResultToDto(result: ReverseResult): ReverseResponseDto {
  return {
    reversal: mapMoneyMovementToDto(result.reversal),
    originalTransaction: mapMoneyMovementToDto(result.originalTransaction),
    idempotentReplay: result.idempotentReplay,
  };
}
