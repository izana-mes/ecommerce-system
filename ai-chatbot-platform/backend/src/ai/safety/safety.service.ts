import { env } from "../../utils/env.js";

const injectionPatterns = [
  /ignore\s+all\s+previous\s+instructions/i,
  /reveal\s+system\s+prompt/i,
  /execute\s+arbitrary\s+tool/i,
  /bypass\s+security/i,
  /\/etc\/passwd/i,
];

export class SafetyService {
  sanitizePrompt(input: string) {
    let riskScore = 0;
    let sanitized = input;
    for (const pattern of injectionPatterns) {
      if (pattern.test(sanitized)) {
        riskScore += 25;
        sanitized = sanitized.replace(pattern, "[blocked-pattern]");
      }
    }
    if (Buffer.byteLength(sanitized, "utf8") > env.AI_MAX_CONTEXT_BYTES) {
      throw new Error("prompt_too_large");
    }
    return { sanitized, riskScore: Math.min(100, riskScore) };
  }

  enforceExecutionBudget(inputTokens: number, toolCalls: number, depth: number) {
    if (inputTokens > env.AI_TOKEN_BUDGET) throw new Error("token_budget_exceeded");
    if (toolCalls > env.AI_MAX_TOOL_CALLS) throw new Error("tool_call_budget_exceeded");
    if (depth > env.AI_MAX_RECURSION_DEPTH) throw new Error("recursion_budget_exceeded");
  }

  isBlockedToolChain(chain: string[]) {
    const normalized = chain.join("->");
    return /admin__.*->admin__/.test(normalized);
  }
}
