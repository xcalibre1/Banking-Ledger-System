import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuditWriterService } from "./services/audit-writer.service";
import { IdempotencyReplayService } from "./services/idempotency-replay.service";

@Module({
  imports: [DatabaseModule],
  providers: [AuditWriterService, IdempotencyReplayService],
  exports: [AuditWriterService, IdempotencyReplayService],
})
export class CommonModule {}
