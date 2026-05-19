import OpenAI from "openai";
import { env } from "../utils/env.js";

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function withRetry<T>(fn: () => Promise<T>, retries = 4): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) throw error;
      const delay = Math.min(3000, 200 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
