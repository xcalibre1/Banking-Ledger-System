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
import { invalidRequest } from "../models/errors";
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
    if (!idempotencyKey) {
      throw invalidRequest("Idempotency-Key is required");
    }

    const result = await this.transfersService.transfer({
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amount: dto.amount,
      idempotencyKey,
      requestId,
    });

    if (!result.idempotentReplay) {
      res.status(201);
    }

    return result;
  }
}
