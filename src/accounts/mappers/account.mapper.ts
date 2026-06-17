import type { Account } from "../../models/account";
import type { AccountResponseDto } from "../dto/account-response.dto";

export function mapAccountToResponse(account: Account): AccountResponseDto {
  return {
    id: account.id,
    name: account.name,
    balance: account.balance.toFixed(2),
    status: account.status,
  };
}
