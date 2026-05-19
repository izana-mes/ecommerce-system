export type McpTransport = "stdio" | "websocket" | "http";

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
};
