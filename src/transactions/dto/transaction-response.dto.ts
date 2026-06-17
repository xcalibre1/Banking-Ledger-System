export class TransactionResponseDto {
  id!: string;
  type!: string;
  status!: string;
  fromAccountId!: string | null;
  toAccountId!: string | null;
  fromAccountName!: string | null;
  toAccountName!: string | null;
  amount!: string;
  idempotencyKey!: string | null;
  reversesTransactionId?: string | null;
  createdAt!: Date;
  completedAt!: Date | null;
}

export class TransactionListResponseDto {
  transactions!: TransactionResponseDto[];
}
