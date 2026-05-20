import { setTimeout as delay } from "node:timers/promises";
import { PermissionService } from "../rbac/permission.service.js";
import { AiAuditService } from "../audit/audit.service.js";
import { incMetric, observeMetric } from "../telemetry/telemetry.service.js";
import type { AgentExecutionContext, ToolExecutionResult } from "../types/runtime.types.js";
import type { RegisteredTool } from "./tool.contracts.js";

const circuitState = new Map<string, { failures: number; openedUntil: number }>();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    delay(timeoutMs).then(() => {
      throw new Error("tool_timeout");
    }),
  ]);
}

export class ToolExecutionMiddleware {
  private readonly permissions = new PermissionService();
  private readonly audit = new AiAuditService();

  async run(ctx: AgentExecutionContext, tool: RegisteredTool, args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const started = Date.now();
    const circuit = circuitState.get(tool.name);
    if (circuit && circuit.openedUntil > Date.now()) {
      return { ok: false, status: "circuit_open", output: null, error: "circuit_open", retries: 0, latencyMs: 0 };
    }

    const permission = this.permissions.canExecute(ctx, tool.name, tool.serverName, args);
    if (!permission.allowed) {
      await this.audit.log({
        traceId: ctx.traceId,
        correlationId: ctx.correlationId,
        conversationId: ctx.conversationId,
        userId: ctx.userId,
        role: ctx.role,
        toolName: tool.name,
        serverName: tool.serverName,
        eventType: "tool_permission_denied",
        status: "denied",
        inputJson: args,
        errorMessage: permission.reason,
      });
      return { ok: false, status: "denied", output: null, error: permission.reason, retries: 0, latencyMs: Date.now() - started };
    }

    const argBytes = Buffer.byteLength(JSON.stringify(args), "utf8");
    if (argBytes > tool.policy.maxInputBytes) {
      return { ok: false, status: "validation_error", output: null, error: "max_input_bytes_exceeded", retries: 0, latencyMs: Date.now() - started };
    }

    const parsedArgs = tool.inputSchema.safeParse(args);
    if (!parsedArgs.success) {
      return { ok: false, status: "validation_error", output: null, error: parsedArgs.error.message, retries: 0, latencyMs: Date.now() - started };
    }

    let retries = 0;
    while (retries <= tool.policy.maxRetries) {
      try {
        const output = await withTimeout(tool.execute(parsedArgs.data), tool.policy.timeoutMs);
        const outBytes = Buffer.byteLength(JSON.stringify(output), "utf8");
        if (outBytes > tool.policy.maxOutputBytes) throw new Error("max_output_bytes_exceeded");

        const parsedOutput = tool.outputSchema.safeParse(output);
        if (!parsedOutput.success) throw new Error(`invalid_output:${parsedOutput.error.message}`);

        const latencyMs = Date.now() - started;
        incMetric("ai_tool_executions_total", { tool: tool.name, status: "success" });
        observeMetric("ai_tool_latency_ms", latencyMs, { tool: tool.name });
        await this.audit.log({
          traceId: ctx.traceId,
          correlationId: ctx.correlationId,
          conversationId: ctx.conversationId,
          userId: ctx.userId,
          role: ctx.role,
          toolName: tool.name,
          serverName: tool.serverName,
          eventType: "tool_execution",
          status: "success",
          durationMs: latencyMs,
          retries,
          inputJson: parsedArgs.data,
          outputJson: parsedOutput.data,
        });
        circuitState.set(tool.name, { failures: 0, openedUntil: 0 });
        return { ok: true, status: "success", output: parsedOutput.data, retries, latencyMs };
      } catch (error) {
        retries += 1;
        const message = error instanceof Error ? error.message : "tool_execution_error";
        if (retries > tool.policy.maxRetries) {
          const latencyMs = Date.now() - started;
          const prev = circuitState.get(tool.name) ?? { failures: 0, openedUntil: 0 };
          const failures = prev.failures + 1;
          const openedUntil = failures >= 3 ? Date.now() + 30_000 : 0;
          circuitState.set(tool.name, { failures, openedUntil });
          await this.audit.log({
            traceId: ctx.traceId,
            correlationId: ctx.correlationId,
            conversationId: ctx.conversationId,
            userId: ctx.userId,
            role: ctx.role,
            toolName: tool.name,
            serverName: tool.serverName,
            eventType: "tool_execution",
            status: message === "tool_timeout" ? "timeout" : "execution_error",
            durationMs: latencyMs,
            retries,
            inputJson: parsedArgs.data,
            errorMessage: message,
          });
          incMetric("ai_tool_executions_total", { tool: tool.name, status: "failure" });
          return { ok: false, status: message === "tool_timeout" ? "timeout" : "execution_error", output: null, error: message, retries, latencyMs };
        }
      }
    }

    return { ok: false, status: "execution_error", output: null, error: "unreachable", retries, latencyMs: Date.now() - started };
  }
}
