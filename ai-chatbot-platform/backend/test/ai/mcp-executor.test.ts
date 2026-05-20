import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("../../src/config/prisma.js", () => ({
  prisma: { toolLog: { create: createMock }, aiAuditEvent: { create: vi.fn() } },
}));

describe("McpExecutor", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("blocks unauthorized tool execution by RBAC", async () => {
    const { McpExecutor } = await import("../../src/mcp/mcp.executor.js");
    const executor = new McpExecutor();

    const result = await executor.execute("admin__mcp_health", {}, {
      userId: "u1",
      role: "guest",
      conversationId: "conv-1",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tool_not_allowed|denied/i);
    expect(createMock).toHaveBeenCalled();
  });

  it("rejects malformed arguments", async () => {
    const { McpExecutor } = await import("../../src/mcp/mcp.executor.js");
    const executor = new McpExecutor();

    const result = await executor.execute("orders__detail", { nope: true }, {
      userId: "u2",
      role: "user",
      conversationId: "conv-2",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("validation_error");
  });

  it("rejects hallucinated tool names", async () => {
    const { McpExecutor } = await import("../../src/mcp/mcp.executor.js");
    const executor = new McpExecutor();

    const result = await executor.execute("imaginary__delete_cluster", {}, {
      userId: "u3",
      role: "admin",
      conversationId: "conv-3",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unknown_tool/i);
  });
});
