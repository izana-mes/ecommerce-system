import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const canExecuteMock = vi.fn();

vi.mock("../../src/config/prisma.js", () => ({
  prisma: { toolLog: { create: createMock } },
}));

vi.mock("../../src/mcp/mcp.permissions.js", () => ({
  ToolPermissionService: class {
    canExecute = canExecuteMock;
  },
}));

describe("McpExecutor", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("blocks unauthorized tool execution", async () => {
    canExecuteMock.mockReturnValue(false);
    const { McpExecutor } = await import("../../src/mcp/mcp.executor.js");
    const executor = new McpExecutor();

    const result = await executor.execute("admin__dangerous", { any: true }, "conv-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/permission denied/i);
    expect(createMock).toHaveBeenCalled();
  });

  it("executes allowed tools and logs success", async () => {
    canExecuteMock.mockReturnValue(true);
    const { McpExecutor } = await import("../../src/mcp/mcp.executor.js");
    const executor = new McpExecutor();

    const result = await executor.execute("health__ping", { a: 1 }, "conv-2");

    expect(result.ok).toBe(true);
    expect(result.output).toBeTruthy();
    expect(createMock).toHaveBeenCalled();
  });
});
