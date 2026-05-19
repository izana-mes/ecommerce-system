import { prisma } from "../config/prisma.js";
import { ToolPermissionService } from "./mcp.permissions.js";

type ToolResult = { ok: boolean; output: unknown; error?: string };

export class McpExecutor {
  private permissions = new ToolPermissionService();

  async execute(toolName: string, args: Record<string, unknown>, conversationId?: string): Promise<ToolResult> {
    const started = Date.now();
    try {
      if (!this.permissions.canExecute(toolName)) {
        throw new Error(`Tool permission denied: ${toolName}`);
      }
      const output = toolName.endsWith("__ping") ? { status: "ok", toolName, args } : { echoed: args };
      await prisma.toolLog.create({
        data: {
          conversationId,
          toolName,
          argsJson: args,
          outputJson: output,
          status: "success",
          latencyMs: Date.now() - started,
        },
      });
      return { ok: true, output };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tool error";
      await prisma.toolLog.create({
        data: {
          conversationId,
          toolName,
          argsJson: args,
          status: "error",
          errorMessage: message,
          latencyMs: Date.now() - started,
        },
      });
      return { ok: false, output: null, error: message };
    }
  }
}
