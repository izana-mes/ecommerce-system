import { prisma } from "../config/prisma.js";
import type { McpTool } from "./mcp.types.js";

export class McpRegistry {
  private tools = new Map<string, McpTool>();

  async loadTools(): Promise<void> {
    const servers = await prisma.mcpServer.findMany({ where: { enabled: true } });
    for (const server of servers) {
      const syntheticTools: McpTool[] = [
        {
          name: `${server.name}__ping`,
          description: `Health check tool for ${server.name}`,
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          serverName: server.name,
        },
      ];
      for (const t of syntheticTools) this.tools.set(t.name, t);
    }
  }

  listTools(): McpTool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): McpTool | undefined {
    return this.tools.get(name);
  }
}
