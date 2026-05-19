import type { FastifyReply } from "fastify";
import { env } from "../utils/env.js";
import { openai, estimateTokens, withRetry } from "../services/openai.service.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { McpRegistry } from "../mcp/mcp.registry.js";
import { McpExecutor } from "../mcp/mcp.executor.js";
import { mapMcpToolsToOpenAITools } from "../mcp/openai-tool.mapper.js";
import { MemoryService } from "../memory/memory.service.js";
import { RagService } from "../rag/rag.service.js";
import { ContextManagerService } from "../services/context-manager.service.js";
import type { AgentRunInput } from "./agent.types.js";

export class AgentService {
  private conversationRepo = new ConversationRepository();
  private mcpRegistry = new McpRegistry();
  private mcpExecutor = new McpExecutor();
  private memoryService = new MemoryService();
  private ragService = new RagService();
  private contextManager = new ContextManagerService();

  async runWithStreaming(input: AgentRunInput, reply: FastifyReply): Promise<void> {
    await this.mcpRegistry.loadTools();
    const messages = await this.conversationRepo.getMessages(input.conversationId);
    const memory = await this.memoryService.retrieveRelevantMemories(input.userId, input.message, 4);
    const rag = await this.ragService.retrieve(input.userId, input.message, 4);

    const rawContext = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const contextWindow = await this.contextManager.summarizeIfNeeded(rawContext);
    const ragContext = rag.map((r) => `(${r.citation}) ${r.content}`).join("\n");

    await this.conversationRepo.addMessage(input.conversationId, "user", input.message, estimateTokens(input.message));
    reply.raw.write(`event: meta\ndata: ${JSON.stringify({ stage: "thinking" })}\n\n`);

    const tools = mapMcpToolsToOpenAITools(this.mcpRegistry.listTools());
    let loopGuard = 0;
    let finalText = "";
    const calledTools = new Set<string>();

    let response = await withRetry(() =>
      openai.responses.create({
        model: env.OPENAI_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are a production assistant. Use tools only when needed. Cite retrieved context as [citation]. Avoid duplicate tool calls.",
          },
          {
            role: "user",
            content: `User Query:\n${input.message}\n\nConversation:\n${contextWindow}\n\nMemory:\n${memory.join("\n")}\n\nRAG:\n${ragContext}`,
          },
        ],
        tools,
        tool_choice: "auto",
      })
    );

    while (loopGuard < 6) {
      loopGuard += 1;
      const toolCalls = response.output.filter((o) => o.type === "function_call");
      if (!toolCalls.length) break;

      for (const call of toolCalls) {
        const name = (call as { name: string }).name;
        const argStr = (call as { arguments: string }).arguments || "{}";
        const dedupeKey = `${name}:${argStr}`;
        if (calledTools.has(dedupeKey)) continue;
        calledTools.add(dedupeKey);

        const args = JSON.parse(argStr);
        reply.raw.write(`event: tool\ndata: ${JSON.stringify({ name, args })}\n\n`);
        const result = await this.mcpExecutor.execute(name, args, input.conversationId);

        response = await withRetry(() =>
          openai.responses.create({
            model: env.OPENAI_MODEL,
            previous_response_id: response.id,
            input: [{ type: "function_call_output", call_id: (call as { call_id: string }).call_id, output: JSON.stringify(result) }],
            tools,
            tool_choice: "auto",
          })
        );
      }
    }

    for (const item of response.output) {
      if (item.type !== "message") continue;
      const parts = (item.content ?? []) as Array<{ type: string; text?: string }>;
      for (const part of parts) {
        if (part.type !== "output_text" || !part.text) continue;
        finalText += part.text;
        reply.raw.write(`event: token\ndata: ${JSON.stringify({ token: part.text })}\n\n`);
      }
    }

    if (!finalText.trim()) finalText = "I could not produce an answer.";
    await this.conversationRepo.addMessage(input.conversationId, "assistant", finalText, estimateTokens(finalText));
    await this.memoryService.createMemory(input.userId, `User: ${input.message}\nAssistant: ${finalText}`, input.conversationId);

    reply.raw.write(`event: done\ndata: ${JSON.stringify({ done: true })}\n\n`);
    reply.raw.end();
  }
}
