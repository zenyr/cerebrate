#!/usr/bin/env bun
import { ToolRegistry } from '@cerebrate/core/registry';
import { MCPServer } from '@cerebrate/server';
import type { CliDeps, CliArgs } from './types';

class TUI {
  async start(): Promise<void> {
    console.log('🚀 Cerebrate TUI starting...');
    console.log('TUI not yet implemented. Use "cerebrate server" or "cerebrate http-server" instead.');
  }
}

export const printUsage = (): void => {
  console.log(`
Cerebrate MCP Server CLI

Usage:
  cerebrate server [--transport stdio|http] [--port <port>]
  cerebrate http-server [--port <port>]
  cerebrate tui

Commands:
  server        Start MCP server with stdio or HTTP transport
  http-server   Start HTTP server with both MCP and SSE endpoints
  tui           Start Terminal User Interface (not implemented)

Options:
  --transport   Transport type: stdio (default) or http
  --port        Port for HTTP server (default: 3878)
  --help        Show this help message
`);
};

export const handleServerCommand = async (
  args: CliArgs,
  deps: CliDeps = {}
): Promise<void> => {
  const { ToolRegistryClass = ToolRegistry, MCPServerClass = MCPServer } = deps;

  const transportIndex = args.indexOf('--transport');
  const portIndex = args.indexOf('--port');

  const transport = transportIndex !== -1 && transportIndex + 1 < args.length && args[transportIndex + 1] === 'http' ? 'http' : 'stdio';
  const portArg = portIndex !== -1 && portIndex + 1 < args.length ? args[portIndex + 1] : undefined;
  const port = portArg ? parseInt(portArg) : 3878;

  const registry = new ToolRegistryClass();
  const server = new MCPServerClass(registry);

  // TODO: Load configuration from file
  const configs: any[] = [];

  if (configs.length > 0) {
    await server.loadScopes(configs);
  }

  await server.start(transport, port);
};

export const handleHttpServerCommand = async (
  args: CliArgs,
  deps: CliDeps = {}
): Promise<void> => {
  const { ToolRegistryClass = ToolRegistry, MCPServerClass = MCPServer } = deps;

  const portIndex = args.indexOf('--port');
  const portArg = portIndex !== -1 && portIndex + 1 < args.length ? args[portIndex + 1] : undefined;
  const port = portArg ? parseInt(portArg) : 3878;

  const registry = new ToolRegistryClass();
  const server = new MCPServerClass(registry);

  // TODO: Load configuration from file
  const configs: any[] = [];

  if (configs.length > 0) {
    await server.loadScopes(configs);
  }

  const app = server.createHonoApp(port);

  console.log(`🚀 Cerebrate HTTP Server starting on port ${port}`);
  console.log(`📡 MCP Streamable HTTP: http://localhost:${port}/mcp`);
  console.log(`📡 MCP SSE: http://localhost:${port}/sse`);

  Bun.serve({
    port,
    fetch: app.fetch,
  });
};

export const handleTuiCommand = async (): Promise<void> => {
  const tui = new TUI();
  await tui.start();
};

export const runCli = async (args: CliArgs): Promise<void> => {
  if (args.length === 0 || args.includes('--help')) {
    printUsage();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'server':
      await handleServerCommand(args.slice(1));
      break;

    case 'http-server':
      await handleHttpServerCommand(args.slice(1));
      break;

    case 'tui':
      await handleTuiCommand();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      throw new Error(`Unknown command: ${command}`);
  }
};

async function main(): Promise<void> {
  const args: CliArgs = process.argv.slice(2);
  await runCli(args);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});