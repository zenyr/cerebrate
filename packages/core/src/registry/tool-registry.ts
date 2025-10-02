import type { MCPTool } from '@cerebrate/core/protocol';

export type ToolName = `${string}/${string}`;
export type ScopeName = string;

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ScopeInfo {
  name: ScopeName;
  description: string;
  tools: MCPTool[];
  serverConfig: MCPServerConfig;
}

export class ToolRegistry {
  private activeScopes = new Set<ScopeName>();
  private availableScopes = new Map<ScopeName, ScopeInfo>();

  registerScope(scope: ScopeInfo) {
    this.availableScopes.set(scope.name, scope);
  }

  activateScope(scopeName: ScopeName): boolean {
    if (!this.availableScopes.has(scopeName)) {
      return false;
    }
    this.activeScopes.add(scopeName);
    return true;
  }

  deactivateScope(scopeName: ScopeName) {
    this.activeScopes.delete(scopeName);
  }

  getActiveScopeNames(): ScopeName[] {
    return Array.from(this.activeScopes);
  }

  getAvailableScopeNames(): ScopeName[] {
    return Array.from(this.availableScopes.keys());
  }

  getExposedTools(): MCPTool[] {
    const tools: MCPTool[] = [];

    for (const scopeName of this.activeScopes) {
      const scope = this.availableScopes.get(scopeName);
      if (!scope) continue;

      for (const tool of scope.tools) {
        tools.push({
          ...tool,
          name: `${scopeName}/${tool.name}`,
        });
      }
    }

    return tools;
  }

  getScopeByToolName(toolName: ToolName): ScopeInfo | undefined {
    const scopeName = toolName.split('/')[0];
    return scopeName ? this.availableScopes.get(scopeName) : undefined;
  }
}
