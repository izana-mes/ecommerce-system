import type { UserRole } from "../ai/types/runtime.types.js";

export type AgentRunInput = {
  userId: string;
  conversationId: string;
  message: string;
  role?: UserRole;
  correlationId?: string;
};
