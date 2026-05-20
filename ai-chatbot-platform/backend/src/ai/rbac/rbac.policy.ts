import type { UserRole } from "../types/runtime.types.js";

export type RolePolicy = {
  allowedTools: string[];
  deniedPrefixes?: string[];
  allowedServers: string[];
  maxRequestsPerMinute: number;
  maxArgBytes: number;
};

export const RBAC_POLICIES: Record<UserRole, RolePolicy> = {
  guest: {
    allowedTools: ["catalog__search", "catalog__recommend"],
    deniedPrefixes: ["filesystem__", "admin__"],
    allowedServers: ["catalog"],
    maxRequestsPerMinute: 20,
    maxArgBytes: 2_000,
  },
  user: {
    allowedTools: ["catalog__search", "catalog__recommend", "orders__get", "orders__detail", "orders__cancel", "returns__create"],
    deniedPrefixes: ["filesystem__", "admin__"],
    allowedServers: ["catalog", "orders"],
    maxRequestsPerMinute: 60,
    maxArgBytes: 8_000,
  },
  premium_user: {
    allowedTools: ["catalog__search", "catalog__recommend", "orders__get", "orders__detail", "orders__cancel", "returns__create"],
    deniedPrefixes: ["filesystem__", "admin__"],
    allowedServers: ["catalog", "orders"],
    maxRequestsPerMinute: 120,
    maxArgBytes: 12_000,
  },
  support_agent: {
    allowedTools: ["support__lookup", "support__update_ticket", "orders__detail"],
    deniedPrefixes: ["filesystem__", "admin__"],
    allowedServers: ["support", "orders"],
    maxRequestsPerMinute: 200,
    maxArgBytes: 16_000,
  },
  admin: {
    allowedTools: ["catalog__search", "catalog__recommend", "orders__get", "orders__detail", "orders__cancel", "returns__create", "admin__mcp_health", "admin__tools_audit"],
    allowedServers: ["catalog", "orders", "support", "admin"],
    maxRequestsPerMinute: 300,
    maxArgBytes: 24_000,
  },
  system: {
    allowedTools: ["*"],
    allowedServers: ["*"],
    maxRequestsPerMinute: 1_000,
    maxArgBytes: 50_000,
  },
};
