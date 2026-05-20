# AI/MCP Production Hardening

## Architecture
- Deny-by-default tool execution via `ToolRegistry` + `ToolExecutionMiddleware`.
- Strict schema validation with `zod` on tool input and output.
- Role-based access control and per-role rate/payload limits.
- AI safety firewall (prompt sanitization, token budget, recursion budget, tool-chain restrictions).
- Runtime state machine for deterministic orchestration and bounded loops.
- Circuit breaker and timeout/retry policies per tool.
- Full audit trail with trace/correlation IDs and structured event records.

## Database Schema
- `ToolLog`: tool invocations, status, retries, trace IDs, attribution.
- `AiAuditEvent`: immutable AI action/event history for incident replay.
- `AiSecurityEvent`: suspicious activity and attack detection events.
- `McpServer`: trust/TLS/fingerprint metadata and allowlist controls.

## Observability
- Structured logs via pino.
- Telemetry hooks: execution counters and latency observations.
- Existing platform OTel/Prometheus stack remains compatible.
- Trace and correlation IDs propagated through agent and tool execution.

## Threat Model
- Prompt injection/context poisoning: sanitized and risk-scored prompts.
- Tool hallucination/malformed calls: unknown tool reject + schema enforcement.
- Privilege escalation: RBAC policy engine + server/tool allowlists.
- Infinite loops/token exhaustion: hard budgets and bounded execution loops.
- MCP trust risks: trusted registry + TLS requirement + stdio block in production path.

## Incident Response Recommendations
1. Query `AiAuditEvent` by `traceId` to reconstruct full agent execution chain.
2. Query `AiSecurityEvent` for high-severity anomalies and repeated abuse.
3. Auto-disable compromised MCP servers via `McpServer.enabled=false`.
4. Tighten `RBAC_POLICIES` and redeploy; rotate MCP auth secrets.
5. Run replay tests against suspicious prompts before re-enabling tools.

## Deployment Recommendations
1. Enforce `NODE_ENV=production` and set strict AI budget env vars.
2. Set `MCP_TRUSTED_SERVERS` explicitly per environment.
3. Run Prisma migrations before deploy and archive old audit partitions.
4. Alert on spikes in `tool_permission_denied`, `execution_error`, and timeout events.
5. Add daily integrity checks for immutable audit tables.
