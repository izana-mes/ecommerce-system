import fs from "node:fs/promises";
import path from "node:path";
import pdfParse from "pdf-parse";
import { prisma } from "../config/prisma.js";
import { env } from "../utils/env.js";
import { openai, withRetry } from "../services/openai.service.js";

function chunkText(content: string, chunkSize = 1200, overlap = 150): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += chunkSize - overlap) {
    chunks.push(content.slice(i, i + chunkSize));
  }
  return chunks;
}

export class RagService {
  async ingestFile(userId: string, filePath: string, mimeType: string): Promise<string> {
    const filename = path.basename(filePath);
    const buffer = await fs.readFile(filePath);
    let text = "";
    if (mimeType === "application/pdf") text = (await pdfParse(buffer)).text;
    else text = buffer.toString("utf8");

    const doc = await prisma.document.create({ data: { userId, filename, mimeType, rawText: text } });
    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i += 1) {
      const c = chunks[i]!;
      const emb = await withRetry(() => openai.embeddings.create({ model: env.OPENAI_EMBEDDING_MODEL, input: c }));
      const vector = emb.data[0]?.embedding ?? [];
      await prisma.$executeRawUnsafe(
        'INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, metadata, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3::vector, $4::jsonb, now())',
        doc.id,
        c,
        `[${vector.join(",")}]`,
        JSON.stringify({ chunkIndex: i, citation: `${filename}#${i}` })
      );
    }
    return doc.id;
  }

  async retrieve(userId: string, query: string, limit = 6): Promise<Array<{ content: string; citation: string }>> {
    const emb = await withRetry(() => openai.embeddings.create({ model: env.OPENAI_EMBEDDING_MODEL, input: query }));
    const vector = emb.data[0]?.embedding ?? [];
    const rows = await prisma.$queryRawUnsafe<Array<{ content: string; metadata: { citation: string } }>>(
      `SELECT dc.content, dc.metadata
       FROM "DocumentChunk" dc
       JOIN "Document" d ON d.id = dc."documentId"
       WHERE d."userId" = $1
       ORDER BY dc.embedding <=> $2::vector
       LIMIT $3`,
      userId,
      `[${vector.join(",")}]`,
      limit
    );
    return rows.map((row) => ({ content: row.content, citation: row.metadata.citation }));
  }
}
