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
import {
  requireIdempotencyKey,
  setCreatedUnlessIdempotentReplay,
} from "../common/utils/idempotency-http.util";
import { ReverseTransactionDto } from "./dto/reverse-transaction.dto";
import { ReversalService } from "./reversal.service";
import { TransactionsService } from "./transactions.service";

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
    const key = requireIdempotencyKey(idempotencyKey);

    const result = await this.reversalService.reverse({
      transactionId,
      idempotencyKey: key,
      requestId,
    });

    setCreatedUnlessIdempotentReplay(res, result.idempotentReplay);
    return result;
  }
}
