import { TransactionResponseDto } from "./transaction-response.dto";

export class ReverseResponseDto {
  reversal!: TransactionResponseDto;
  originalTransaction!: TransactionResponseDto;
  idempotentReplay!: boolean;
}
