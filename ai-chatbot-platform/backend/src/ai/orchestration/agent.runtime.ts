import type { AgentExecutionContext } from "../types/runtime.types.js";

export type RuntimeState = "idle" | "thinking" | "executing_tool" | "synthesizing" | "done" | "failed" | "cancelled";

export class AgentRuntimeController {
  private state: RuntimeState = "idle";
  private cancelled = false;

  transition(next: RuntimeState) {
    const allowed: Record<RuntimeState, RuntimeState[]> = {
      idle: ["thinking", "cancelled"],
      thinking: ["executing_tool", "synthesizing", "failed", "cancelled"],
      executing_tool: ["thinking", "synthesizing", "failed", "cancelled"],
      synthesizing: ["done", "failed", "cancelled"],
      done: [],
      failed: [],
      cancelled: [],
    };
    if (!allowed[this.state].includes(next)) throw new Error(`invalid_state_transition:${this.state}->${next}`);
    this.state = next;
  }

  getState() {
    return this.state;
  }

  cancel() {
    this.cancelled = true;
    this.state = "cancelled";
  }

  assertNotCancelled(_ctx: AgentExecutionContext) {
    if (this.cancelled) throw new Error("execution_cancelled");
  }
}

export function parseJsonSafely<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
