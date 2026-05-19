import { prisma } from "../config/prisma.js";

export class ConversationRepository {
  create(userId: string, title: string) {
    return prisma.conversation.create({ data: { userId, title } });
  }

  getMessages(conversationId: string) {
    return prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
  }

  addMessage(conversationId: string, role: string, content: string, tokenCount?: number, toolCallsJson?: unknown) {
    return prisma.message.create({ data: { conversationId, role, content, tokenCount, toolCallsJson: toolCallsJson as never } });
  }
}
