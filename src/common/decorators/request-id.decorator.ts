import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Request } from "express";

export const RequestId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.header("x-request-id")?.trim() ?? randomUUID();
  },
);
