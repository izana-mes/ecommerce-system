export type McpTransport = "stdio" | "websocket" | "http";

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
};

export type ToolExecutionContextInput = {
  userId: string;
  role: "guest" | "user" | "premium_user" | "support_agent" | "admin" | "system";
  conversationId: string;
  correlationId?: string;
  depth?: number;
};
