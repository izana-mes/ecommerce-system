export type UserRole = "guest" | "user" | "premium_user" | "support_agent" | "admin" | "system";

export type ToolExecutionStatus =
  | "success"
  | "denied"
  | "validation_error"
  | "timeout"
  | "execution_error"
  | "circuit_open";

export type AgentExecutionContext = {
  traceId: string;
  correlationId: string;
  conversationId: string;
  userId: string;
  role: UserRole;
  maxDepth: number;
  depth: number;
  requestStartMs: number;
};

export type ToolExecutionResult = {
  ok: boolean;
  status: ToolExecutionStatus;
  output: unknown;
  error?: string;
  retries: number;
  latencyMs: number;
};
