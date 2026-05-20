import { createHash } from "node:crypto";
import { RBAC_POLICIES } from "./rbac.policy.js";
import type { AgentExecutionContext } from "../types/runtime.types.js";

const rateWindowMs = 60_000;
const hitBucket = new Map<string, number[]>();

export class PermissionService {
  canExecute(ctx: AgentExecutionContext, toolName: string, serverName: string, args: Record<string, unknown>) {
    const policy = RBAC_POLICIES[ctx.role];
    const now = Date.now();
    const key = `${ctx.userId}:${ctx.role}:${Math.floor(now / rateWindowMs)}`;
    const hits = hitBucket.get(key) ?? [];
    const activeHits = hits.filter((t) => now - t < rateWindowMs);
    if (activeHits.length >= policy.maxRequestsPerMinute) {
      return { allowed: false, reason: "rate_limit_exceeded" };
    }

    const argBytes = Buffer.byteLength(JSON.stringify(args), "utf8");
    if (argBytes > policy.maxArgBytes) {
      return { allowed: false, reason: "argument_size_exceeded" };
    }

    const denyMatch = (policy.deniedPrefixes ?? []).some((prefix) => toolName.startsWith(prefix));
    if (denyMatch) return { allowed: false, reason: "tool_prefix_denied" };

    const toolAllowed = policy.allowedTools.includes("*") || policy.allowedTools.includes(toolName);
    if (!toolAllowed) return { allowed: false, reason: "tool_not_allowed" };

    const serverAllowed = policy.allowedServers.includes("*") || policy.allowedServers.includes(serverName);
    if (!serverAllowed) return { allowed: false, reason: "server_not_allowed" };

    activeHits.push(now);
    hitBucket.set(key, activeHits);
    return { allowed: true as const, reason: "ok", requestHash: createHash("sha256").update(JSON.stringify(args)).digest("hex") };
  }
}
