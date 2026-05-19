import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AgentService } from "../agents/agent.service.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";

const askSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1),
});

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  const agent = new AgentService();
  const convo = new ConversationRepository();

  app.post("/conversations", { preHandler: [app.authenticate] }, async (request) => {
    const userId = (request.user as { sub: string }).sub;
    return convo.create(userId, "New Chat");
  });

  app.get("/conversations/:id/messages", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    return convo.getMessages(params.id);
  });

  app.post("/chat/stream", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const body = askSchema.parse(request.body);

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");

    await agent.runWithStreaming({ userId, conversationId: body.conversationId, message: body.message }, reply);
  });
}
