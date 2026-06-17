import { TransactionResponseDto } from "../../transactions/dto/transaction-response.dto";

export class TransferBalancesDto {
  fromAccountId!: string;
  fromBalance!: string;
  toAccountId!: string;
  toBalance!: string;
}

export class TransferResponseDto {
  transaction!: TransactionResponseDto;
  balances!: TransferBalancesDto;
  idempotentReplay!: boolean;
}
