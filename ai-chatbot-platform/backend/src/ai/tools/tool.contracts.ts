import { z } from "zod";

export const baseOutputSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export type ToolExecutionPolicy = {
  timeoutMs: number;
  maxInputBytes: number;
  maxOutputBytes: number;
  maxRetries: number;
  allowChainedExecution: boolean;
};

export type RegisteredTool = {
  name: string;
  serverName: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  policy: ToolExecutionPolicy;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
};
