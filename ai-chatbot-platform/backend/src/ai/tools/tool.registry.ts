import { z } from "zod";
import type { RegisteredTool } from "./tool.contracts.js";

const emptyObj = z.object({}).strict();
const userIdSchema = z.object({ userId: z.string().min(1).max(64) }).strict();
const orderIdSchema = z.object({ orderId: z.string().min(1).max(64) }).strict();
const searchSchema = z.object({ query: z.string().min(1).max(120), limit: z.number().int().min(1).max(20).default(5) }).strict();
const returnSchema = z.object({ orderId: z.string().min(1).max(64), reason: z.string().min(5).max(280) }).strict();

const defaultPolicy = { timeoutMs: 4_000, maxInputBytes: 8_000, maxOutputBytes: 32_000, maxRetries: 2, allowChainedExecution: false };

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  constructor() {
    this.registerMany([
      {
        name: "orders__get",
        serverName: "orders",
        description: "Get orders for a user",
        inputSchema: userIdSchema,
        outputSchema: z.object({ success: z.boolean(), data: z.array(z.object({ orderId: z.string() })) }),
        policy: defaultPolicy,
        execute: async (args) => ({ success: true, data: [{ orderId: `mock-${String(args.userId)}` }] }),
      },
      {
        name: "orders__detail",
        serverName: "orders",
        description: "Get order details",
        inputSchema: orderIdSchema,
        outputSchema: z.object({ success: z.boolean(), data: z.object({ orderId: z.string(), status: z.string() }) }),
        policy: defaultPolicy,
        execute: async (args) => ({ success: true, data: { orderId: String(args.orderId), status: "processing" } }),
      },
      {
        name: "catalog__search",
        serverName: "catalog",
        description: "Search products",
        inputSchema: searchSchema,
        outputSchema: z.object({ success: z.boolean(), data: z.array(z.object({ id: z.string(), name: z.string() })) }),
        policy: defaultPolicy,
        execute: async (args) => ({ success: true, data: [{ id: "p1", name: `Result for ${String(args.query)}` }] }),
      },
      {
        name: "catalog__recommend",
        serverName: "catalog",
        description: "Recommend products",
        inputSchema: userIdSchema,
        outputSchema: z.object({ success: z.boolean(), data: z.array(z.object({ id: z.string() })) }),
        policy: defaultPolicy,
        execute: async () => ({ success: true, data: [{ id: "rec-1" }, { id: "rec-2" }] }),
      },
      {
        name: "returns__create",
        serverName: "orders",
        description: "Create return request",
        inputSchema: returnSchema,
        outputSchema: z.object({ success: z.boolean(), data: z.object({ ticketId: z.string() }) }),
        policy: { ...defaultPolicy, timeoutMs: 6_000 },
        execute: async (args) => ({ success: true, data: { ticketId: `ret-${String(args.orderId)}` } }),
      },
      {
        name: "admin__mcp_health",
        serverName: "admin",
        description: "MCP health summary",
        inputSchema: emptyObj,
        outputSchema: z.object({ success: z.boolean(), data: z.object({ healthy: z.boolean() }) }),
        policy: defaultPolicy,
        execute: async () => ({ success: true, data: { healthy: true } }),
      },
      {
        name: "admin__tools_audit",
        serverName: "admin",
        description: "Tool execution audit",
        inputSchema: emptyObj,
        outputSchema: z.object({ success: z.boolean(), data: z.object({ enabled: z.boolean() }) }),
        policy: defaultPolicy,
        execute: async () => ({ success: true, data: { enabled: true } }),
      },
    ]);
  }

  registerMany(tools: RegisteredTool[]) {
    for (const tool of tools) this.tools.set(tool.name, tool);
  }

  get(toolName: string) {
    return this.tools.get(toolName);
  }

  list() {
    return Array.from(this.tools.values());
  }
}
