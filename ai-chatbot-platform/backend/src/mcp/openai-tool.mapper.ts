import type { ResponseCreateParams } from "openai/resources/responses/responses";
import type { McpTool } from "./mcp.types.js";

export function mapMcpToolsToOpenAITools(tools: McpTool[]): ResponseCreateParams.Tool[] {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    strict: true,
  }));
}
