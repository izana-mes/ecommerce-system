import { env } from "../../utils/env.js";

export type TrustedMcpServer = {
  name: string;
  transport: "http" | "websocket" | "stdio";
  endpoint?: string;
  tlsRequired: boolean;
  enabled: boolean;
};

export class SecureMcpConnector {
  validateServer(server: TrustedMcpServer) {
    if (!server.enabled) throw new Error("mcp_server_disabled");
    const allowlist = env.MCP_TRUSTED_SERVERS.split(",").map((v) => v.trim()).filter(Boolean);
    if (!allowlist.includes(server.name)) throw new Error("mcp_server_not_trusted");

    if (server.transport !== "stdio" && server.endpoint) {
      const parsed = new URL(server.endpoint);
      if (server.tlsRequired && parsed.protocol !== "https:") throw new Error("mcp_tls_required");
    }

    if (server.transport === "stdio") {
      throw new Error("stdio_transport_blocked_in_production");
    }
  }
}
