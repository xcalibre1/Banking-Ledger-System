export class AccountResponseDto {
  id!: string;
  name!: string;
  balance!: string;
  status!: string;
}

export class AccountsListResponseDto {
  accounts!: AccountResponseDto[];
}
