import type { McpTool } from "./mcp.types.js";
import { ToolRegistry } from "../ai/tools/tool.registry.js";

export class McpRegistry {
  private tools = new Map<string, McpTool>();
  private secureRegistry = new ToolRegistry();

  async loadTools(): Promise<void> {
    this.tools.clear();
    for (const t of this.secureRegistry.list()) {
      this.tools.set(t.name, {
        name: t.name,
        description: t.description,
        serverName: t.serverName,
        inputSchema: { type: "object", additionalProperties: true },
      });
    }
  }

  listTools(): McpTool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): McpTool | undefined {
    return this.tools.get(name);
  }
}
