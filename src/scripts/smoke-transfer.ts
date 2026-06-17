import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { TransfersService } from "../transfers/transfers.service";
import { PrismaService } from "../prisma/prisma.service";
import { formatMoney, toDecimal } from "../lib/money";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const transfersService = app.get(TransfersService);
  const prisma = app.get(PrismaService);

  const source = await prisma.account.create({
    data: { name: "Source", balance: "100.0000" },
  });
  const destination = await prisma.account.create({
    data: { name: "Destination", balance: "0.0000" },
  });

  const result = await transfersService.transfer({
    fromAccountId: source.id,
    toAccountId: destination.id,
    amount: "25.50",
    idempotencyKey: randomUUID(),
    requestId: randomUUID(),
  });

  console.log("Transfer result:", JSON.stringify(result, null, 2));

  const replay = await transfersService.transfer({
    fromAccountId: source.id,
    toAccountId: destination.id,
    amount: "25.50",
    idempotencyKey: result.transaction.idempotencyKey!,
    requestId: randomUUID(),
  });

  console.log("Idempotent replay:", replay.idempotentReplay);

  const [sourceAfter, destAfter] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: source.id } }),
    prisma.account.findUniqueOrThrow({ where: { id: destination.id } }),
  ]);

  console.log("Final balances:", {
    source: formatMoney(toDecimal(sourceAfter.balance)),
    destination: formatMoney(toDecimal(destAfter.balance)),
  });

  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
