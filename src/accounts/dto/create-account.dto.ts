import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: "initialBalance must be a valid monetary amount",
  })
  initialBalance?: string;
}
