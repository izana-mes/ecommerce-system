import { prisma } from "../config/prisma.js";
import { openai, withRetry } from "../services/openai.service.js";
import { env } from "../utils/env.js";

export class MemoryService {
  async createMemory(userId: string, text: string, conversationId?: string): Promise<void> {
    const emb = await withRetry(() => openai.embeddings.create({ model: env.OPENAI_EMBEDDING_MODEL, input: text }));
    const vector = emb.data[0]?.embedding ?? [];
    await prisma.$executeRawUnsafe(
      'INSERT INTO "Memory" (id, "userId", "conversationId", text, embedding, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, now())',
      userId,
      conversationId ?? null,
      text,
      `[${vector.join(",")}]`
    );
  }

  async retrieveRelevantMemories(userId: string, query: string, limit = 5): Promise<string[]> {
    const emb = await withRetry(() => openai.embeddings.create({ model: env.OPENAI_EMBEDDING_MODEL, input: query }));
    const vector = emb.data[0]?.embedding ?? [];
    const rows = await prisma.$queryRawUnsafe<{ text: string }[]>(
      'SELECT text FROM "Memory" WHERE "userId" = $1 ORDER BY embedding <=> $2::vector LIMIT $3',
      userId,
      `[${vector.join(",")}]`,
      limit
    );
    return rows.map((r) => r.text);
  }
}
