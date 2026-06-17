import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const header = request.header("idempotency-key");
    const body = request.body as { idempotencyKey?: string } | undefined;
    return header?.trim() ?? body?.idempotencyKey?.trim();
  },
);
