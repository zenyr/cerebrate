import type { MCPTool } from '@cerebrate/core/protocol';

export const ENABLE_TOOLS: MCPTool = {
  name: 'enableTools',
  description: 'Activate MCP server scope to expose its tools',
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        description: 'MCP server namespace to activate (e.g., "filesystem", "github")',
      },
    },
    required: ['scope'],
  },
};

export const LIST_AVAILABLE_SCOPES: MCPTool = {
  name: 'listAvailableScopes',
  description: 'List all available MCP server scopes that can be activated',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const CORE_TOOLS: MCPTool[] = [ENABLE_TOOLS, LIST_AVAILABLE_SCOPES];
