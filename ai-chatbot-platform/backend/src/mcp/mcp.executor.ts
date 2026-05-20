import { prisma } from "../config/prisma.js";
import { ToolRegistry } from "../ai/tools/tool.registry.js";
import { ToolExecutionMiddleware } from "../ai/tools/tool.execution.middleware.js";
import { buildRequestContext } from "../ai/auth/request-context.js";
import type { ToolExecutionContextInput } from "./mcp.types.js";

type ToolResult = { ok: boolean; output: unknown; error?: string; status?: string };

export class McpExecutor {
  private middleware = new ToolExecutionMiddleware();
  private registry = new ToolRegistry();

  async execute(toolName: string, args: Record<string, unknown>, ctxInput: ToolExecutionContextInput): Promise<ToolResult> {
    const started = Date.now();
    try {
      const tool = this.registry.get(toolName);
      if (!tool) {
        throw new Error(`unknown_tool:${toolName}`);
      }

      const base = buildRequestContext({
        userId: ctxInput.userId,
        conversationId: ctxInput.conversationId,
        role: ctxInput.role,
        correlationId: ctxInput.correlationId,
      });
      const ctx = { ...base, maxDepth: 6, depth: ctxInput.depth ?? 0 };

      const result = await this.middleware.run(ctx, tool, args);
      await (prisma as any).toolLog.create({
        data: {
          conversationId: ctxInput.conversationId,
          toolName,
          argsJson: args,
          outputJson: result.output,
          status: result.status,
          errorMessage: result.error,
          latencyMs: result.latencyMs,
          retries: result.retries,
          traceId: ctx.traceId,
          correlationId: ctx.correlationId,
          userId: ctx.userId,
          role: ctx.role,
          serverName: tool.serverName,
        },
      });
      return { ok: result.ok, output: result.output, error: result.error, status: result.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tool error";
      await (prisma as any).toolLog.create({
        data: {
          conversationId: ctxInput.conversationId,
          toolName,
          argsJson: args,
          status: "execution_error",
          errorMessage: message,
          latencyMs: Date.now() - started,
          retries: 0,
          traceId: "unknown",
          correlationId: ctxInput.correlationId ?? "unknown",
          userId: ctxInput.userId,
          role: ctxInput.role,
          serverName: "unknown",
        },
      });
      return { ok: false, output: null, error: message, status: "execution_error" };
    }
  }
}
