import { IsNotEmpty, IsString, IsUUID, Matches } from "class-validator";

export class CreateTransferDto {
  @IsUUID("4", { message: "fromAccountId must be a valid UUID" })
  fromAccountId!: string;

  @IsUUID("4", { message: "toAccountId must be a valid UUID" })
  toAccountId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: "amount must be a positive number with up to 4 decimal places",
  })
  amount!: string;
}
