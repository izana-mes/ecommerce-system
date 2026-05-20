import { randomUUID } from "node:crypto";
import type { UserRole } from "../types/runtime.types.js";

export function buildRequestContext(input: {
  userId: string;
  conversationId: string;
  role?: UserRole;
  correlationId?: string;
}) {
  const traceId = randomUUID();
  return {
    traceId,
    correlationId: input.correlationId ?? traceId,
    userId: input.userId,
    conversationId: input.conversationId,
    role: input.role ?? "user",
    requestStartMs: Date.now(),
  };
}
