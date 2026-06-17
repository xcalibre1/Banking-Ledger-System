import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ReversalService } from "./reversal.service";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";


@Module({
  imports: [DatabaseModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, ReversalService],
})
export class TransactionsModule {}
