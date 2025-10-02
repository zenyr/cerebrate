import { ToolRegistry } from '@cerebrate/core/registry';
import { MCPServer } from '@cerebrate/server';

export interface CliDeps {
  ToolRegistryClass?: typeof ToolRegistry;
  MCPServerClass?: typeof MCPServer;
}

export type CliArgs = string[];

export interface MockServer {
  start: (transport?: string, port?: number) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
  loadScopes: () => Promise<void>;
  createHonoApp: (port: number) => any;
}

// For testing purposes
export interface TestCliDeps {
  ToolRegistryClass?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  MCPServerClass?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  mockServer: MockServer;
}