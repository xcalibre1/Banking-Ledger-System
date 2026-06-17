import {
  Body,
  Controller,
  HttpCode,
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
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { TransfersService } from "./transfers.service";

@Controller("api/v1/transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @HttpCode(200)
  async create(
    @Body() dto: CreateTransferDto,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @RequestId() requestId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = requireIdempotencyKey(idempotencyKey);

    const result = await this.transfersService.transfer({
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amount: dto.amount,
      idempotencyKey: key,
      requestId,
    });

    setCreatedUnlessIdempotentReplay(res, result.idempotentReplay);
    return result;
  }
}
