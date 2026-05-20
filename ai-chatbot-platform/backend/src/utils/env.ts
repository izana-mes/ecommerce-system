import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default("gpt-4.1"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  JWT_SECRET: z.string().min(16),
  AI_MAX_CONTEXT_BYTES: z.coerce.number().default(32_000),
  AI_TOKEN_BUDGET: z.coerce.number().default(12_000),
  AI_MAX_TOOL_CALLS: z.coerce.number().default(6),
  AI_MAX_RECURSION_DEPTH: z.coerce.number().default(6),
  MCP_TRUSTED_SERVERS: z.string().default("catalog,orders,support,admin"),
});

export const env = schema.parse(process.env);
