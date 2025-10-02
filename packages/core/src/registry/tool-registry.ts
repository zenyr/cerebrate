import type { Tool } from '@cerebrate/core/protocol';

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
  serverInfo: {
    name: string;
    version: string;
  };
  instructions?: string;
  tools: Tool[];
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

  getExposedTools(): Tool[] {
    const tools: Tool[] = [];

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

  getScopeInfo(scopeName: ScopeName): ScopeInfo | undefined {
    return this.availableScopes.get(scopeName);
  }

  getToolUsageGuide(scopeName: ScopeName): string | undefined {
    const scope = this.availableScopes.get(scopeName);
    if (!scope) return undefined;

    const header = `Scope "${scopeName}" activated (${scope.serverInfo.name} v${scope.serverInfo.version})`;
    const instructions = scope.instructions ? `\n\n${scope.instructions}` : '';
    
    const toolList = scope.tools
      .map((tool) => `- ${scopeName}/${tool.name}: ${tool.description || 'No description'}`)
      .join('\n');

    return `${header}${instructions}\n\nAvailable tools:\n${toolList}\n\nCall format: {scope}/{toolName}`;
  }

  getScopeToolsInfo(scopeName: ScopeName) {
    const scope = this.availableScopes.get(scopeName);
    if (!scope) return undefined;

    return {
      scope: scopeName,
      tools: scope.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema,
      })),
    };
  }

  getAllScopesInfo() {
    return Array.from(this.availableScopes.values()).map((scope) => ({
      scope: scope.name,
      serverInfo: scope.serverInfo,
      instructions: scope.instructions,
      tools: scope.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
      })),
    }));
  }
}
