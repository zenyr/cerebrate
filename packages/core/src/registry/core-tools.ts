import type { Tool } from '@cerebrate/core/protocol';

export const ENABLE_TOOLS: Tool = {
  name: 'enableTools',
  description:
    'Activate MCP server scope to expose its tools. After activation, tools will be available as {scope}/{tool} format (e.g., filesystem/read_file).',
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

export const LIST_AVAILABLE_SCOPES: Tool = {
  name: 'listAvailableScopes',
  description:
    'List all available MCP server scopes with their tools. Use this to discover what scopes and tools are available before activating them.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const CORE_TOOLS: Tool[] = [ENABLE_TOOLS, LIST_AVAILABLE_SCOPES];
