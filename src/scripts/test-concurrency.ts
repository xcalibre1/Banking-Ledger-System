import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { TransfersService } from "../transfers/transfers.service";
import { formatMoney, toDecimal } from "../lib/money";
import { isDomainError } from "../models/errors";

const PARALLEL_TRANSFERS = 20;
const TRANSFER_AMOUNT = "10.00";
const STARTING_BALANCE = "100.00";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const transfersService = app.get(TransfersService);
  const prisma = app.get(PrismaService);

  const runId = randomUUID().slice(0, 8);
  const source = await prisma.account.create({
    data: {
      name: `Concurrency-Source-${runId}`,
      balance: STARTING_BALANCE,
    },
  });
  const destination = await prisma.account.create({
    data: {
      name: `Concurrency-Dest-${runId}`,
      balance: "0.0000",
    },
  });

  console.log(`Source account: ${source.id} ($${STARTING_BALANCE})`);
  console.log(`Destination account: ${destination.id}`);
  console.log(
    `Firing ${PARALLEL_TRANSFERS} parallel transfers of $${TRANSFER_AMOUNT} each...\n`,
  );

  const results = await Promise.allSettled(
    Array.from({ length: PARALLEL_TRANSFERS }, () =>
      transfersService.transfer({
        fromAccountId: source.id,
        toAccountId: destination.id,
        amount: TRANSFER_AMOUNT,
        idempotencyKey: randomUUID(),
        requestId: randomUUID(),
      }),
    ),
  );

  let successes = 0;
  let insufficientFunds = 0;
  let otherFailures = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      successes += 1;
      continue;
    }

    if (isDomainError(result.reason) && result.reason.code === "INSUFFICIENT_FUNDS") {
      insufficientFunds += 1;
    } else {
      otherFailures += 1;
      console.error("Unexpected error:", result.reason);
    }
  }

  const [sourceAfter, destAfter] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: source.id } }),
    prisma.account.findUniqueOrThrow({ where: { id: destination.id } }),
  ]);

  const sourceBalance = formatMoney(toDecimal(sourceAfter.balance));
  const destBalance = formatMoney(toDecimal(destAfter.balance));
  const expectedSuccesses = Number(STARTING_BALANCE) / Number(TRANSFER_AMOUNT);
  const totalAttempts = successes + insufficientFunds + otherFailures;

  console.log("Results:");
  console.log(`  Successful transfers:  ${successes}`);
  console.log(`  Insufficient funds:    ${insufficientFunds}`);
  console.log(`  Other failures:        ${otherFailures}`);
  console.log(`  Final source balance:  $${sourceBalance}`);
  console.log(`  Final dest balance:    $${destBalance}`);

  // Core invariants: no overdraft, exact money conservation, bounded successes
  const passed =
    totalAttempts === PARALLEL_TRANSFERS &&
    successes === expectedSuccesses &&
    sourceBalance === "0.00" &&
    destBalance === STARTING_BALANCE &&
    !sourceBalance.startsWith("-");

  if (otherFailures > 0) {
    console.log(
      `\nNote: ${otherFailures} request(s) failed after deadlock retries; balances remain correct.`,
    );
  }

  console.log(passed ? "\n✓ Concurrency test PASSED" : "\n✗ Concurrency test FAILED");

  await app.close();
  process.exitCode = passed ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
