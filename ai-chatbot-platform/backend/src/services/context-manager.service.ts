import { openai, withRetry } from "./openai.service.js";
import { env } from "../utils/env.js";

export class ContextManagerService {
  async summarizeIfNeeded(messages: string): Promise<string> {
    if (messages.length < 12000) return messages;
    const resp = await withRetry(() =>
      openai.responses.create({
        model: env.OPENAI_MODEL,
        input: [
          { role: "system", content: "Summarize conversation preserving facts and unresolved tasks." },
          { role: "user", content: messages },
        ],
        max_output_tokens: 800,
      })
    );
    return resp.output_text || messages.slice(-8000);
  }
}
