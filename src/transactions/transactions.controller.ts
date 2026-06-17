import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { IdempotencyKey } from "../common/decorators/idempotency-key.decorator";
import { RequestId } from "../common/decorators/request-id.decorator";
import { invalidRequest } from "../models/errors";
import { ReversalService } from "./reversal.service";
import { TransactionsService } from "./transactions.service";

class ReverseTransactionDto {
  idempotencyKey?: string;
}

@Controller("api/v1/transactions")
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly reversalService: ReversalService,
  ) {}

  @Get()
  findRecent() {
    return this.transactionsService.findRecent();
  }

  @Post(":id/reverse")
  @HttpCode(200)
  async reverse(
    @Param("id", ParseUUIDPipe) transactionId: string,
    @Body() _body: ReverseTransactionDto,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @RequestId() requestId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!idempotencyKey) {
      throw invalidRequest("Idempotency-Key is required");
    }

    const result = await this.reversalService.reverse({
      transactionId,
      idempotencyKey,
      requestId,
    });

    if (!result.idempotentReplay) {
      res.status(201);
    }

    return result;
  }
}
