import { prisma } from "../../config/prisma.js";
import { logger } from "../../utils/logger.js";

export type AuditEventInput = {
  traceId: string;
  correlationId: string;
  conversationId?: string;
  userId?: string;
  role?: string;
  eventType: string;
  serverName?: string;
  toolName?: string;
  status: string;
  durationMs?: number;
  retries?: number;
  tokenUsage?: number;
  inputJson?: unknown;
  outputJson?: unknown;
  errorMessage?: string;
  metadataJson?: unknown;
};

export class AiAuditService {
  async log(event: AuditEventInput): Promise<void> {
    logger.info({ event: "ai_audit", ...event });
    await (prisma as any).aiAuditEvent.create({ data: event as never });
  }
}
