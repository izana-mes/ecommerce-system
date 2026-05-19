import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.mcpServer.upsert({
    where: { name: "filesystem" },
    create: {
      name: "filesystem",
      transport: "stdio",
      command: process.env.MCP_FILESYSTEM_CMD ?? "npx",
      argsJson: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      enabled: true,
    },
    update: { enabled: true },
  });

  await prisma.mcpServer.upsert({
    where: { name: "github" },
    create: {
      name: "github",
      transport: "stdio",
      command: process.env.MCP_GITHUB_CMD ?? "npx",
      argsJson: ["-y", "@modelcontextprotocol/server-github"],
      enabled: true,
    },
    update: { enabled: true },
  });

  await prisma.mcpServer.upsert({
    where: { name: "browser" },
    create: {
      name: "browser",
      transport: "websocket",
      endpoint: process.env.MCP_BROWSER_WS_URL ?? "ws://browser-mcp:8080",
      enabled: true,
    },
    update: { enabled: true },
  });
}

main().finally(() => prisma.$disconnect());
