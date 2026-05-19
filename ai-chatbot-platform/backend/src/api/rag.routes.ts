import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { RagService } from "../rag/rag.service.js";

export async function ragRoutes(app: FastifyInstance): Promise<void> {
  const rag = new RagService();

  app.post("/rag/ingest", { preHandler: [app.authenticate] }, async (request) => {
    const userId = (request.user as { sub: string }).sub;
    const body = request.body as { filename: string; contentBase64: string; mimeType: string };
    const folder = "/tmp/rag-uploads";
    await fs.mkdir(folder, { recursive: true });
    const filePath = path.join(folder, `${Date.now()}-${body.filename}`);
    await fs.writeFile(filePath, Buffer.from(body.contentBase64, "base64"));
    const id = await rag.ingestFile(userId, filePath, body.mimeType);
    return { documentId: id };
  });
}
