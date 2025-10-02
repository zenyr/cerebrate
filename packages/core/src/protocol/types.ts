export const DEFAULT_PORT = 3878;
export const AUTH_CODE_PREFIX = 'ck-';
export const MCP_PROTOCOL_VERSION = '2024-11-05';

export type MCPMethod =
  | 'initialize'
  | 'tools/list'
  | 'tools/call'
  | 'notifications/tools/list_changed';

export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo?: {
    name: string;
    version: string;
  };
}

export interface ClientCapabilities {
  roots?: { listChanged?: boolean };
  sampling?: Record<string, unknown>;
  experimental?: Record<string, unknown>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface ToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
