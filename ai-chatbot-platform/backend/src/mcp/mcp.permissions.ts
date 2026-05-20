import { PermissionService } from "../ai/rbac/permission.service.js";
import type { AgentExecutionContext } from "../ai/types/runtime.types.js";

export class ToolPermissionService {
  private permissionService = new PermissionService();

  canExecute(ctx: AgentExecutionContext, toolName: string, serverName: string, args: Record<string, unknown>): boolean {
    return this.permissionService.canExecute(ctx, toolName, serverName, args).allowed;
  }
}
