import { Injectable, Logger } from "@nestjs/common";
import type { AuditEventInput } from "../../models/audit";
import { AuditRepository } from "../../repositories/audit.repository";

@Injectable()
export class AuditWriterService {
  private readonly logger = new Logger(AuditWriterService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  async writeFailure(event: AuditEventInput, context: string): Promise<void> {
    try {
      await this.auditRepository.createStandalone(event);
    } catch (error) {
      this.logger.error(`Failed to write ${context} audit event`, error);
    }
  }
}
