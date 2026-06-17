import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { DatabaseModule } from "../database/database.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
