import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "node:path";
import { DomainExceptionFilter } from "./common/filters/domain-exception.filter";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { AccountsModule } from "./accounts/accounts.module";
import { TransfersModule } from "./transfers/transfers.module";

@Module({
  imports: [
    PrismaModule,
    DatabaseModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "client", "dist"),
      exclude: ["/api*"],
    }),
    HealthModule,
    AccountsModule,
    TransfersModule,
    TransactionsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
