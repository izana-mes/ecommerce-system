export class ToolPermissionService {
  private allowlist = new Set<string>([
    "filesystem__ping",
    "github__ping",
    "browser__ping",
  ]);

  canExecute(toolName: string): boolean {
    return this.allowlist.has(toolName);
  }
}
