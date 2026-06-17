import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { RequestId } from "../common/decorators/request-id.decorator";
import { AccountsService } from "./accounts.service";
import { CreateAccountDto } from "./dto/create-account.dto";

@Controller("api/v1/accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll() {
    return this.accountsService.findAll();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateAccountDto, @RequestId() requestId: string) {
    return this.accountsService.create(dto, requestId);
  }
}
