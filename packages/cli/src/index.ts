#!/usr/bin/env bun
import { ToolRegistry } from '@cerebrate/core/registry';
import { MCPServer } from '@cerebrate/server';

class TUI {
  async start(): Promise<void> {
    console.log('🚀 Cerebrate TUI starting...');
    console.log('TUI not yet implemented. Use "cerebrate server" or "cerebrate http-server" instead.');
  }
}

function printUsage(): void {
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
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    printUsage();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'server': {
      const transportIndex = args.indexOf('--transport');
      const portIndex = args.indexOf('--port');

      const transport = transportIndex !== -1 && args[transportIndex + 1] === 'http' ? 'http' : 'stdio';
      const port = portIndex !== -1 ? parseInt(args[portIndex + 1]) : 3878;

      const registry = new ToolRegistry();
      const server = new MCPServer(registry);

      // TODO: Load configuration from file
      const configs: any[] = [];

      if (configs.length > 0) {
        await server.loadScopes(configs);
      }

      await server.start(transport, port);
      break;
    }

    case 'http-server': {
      const portIndex = args.indexOf('--port');
      const port = portIndex !== -1 ? parseInt(args[portIndex + 1]) : 3878;

      const registry = new ToolRegistry();
      const server = new MCPServer(registry);

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
      break;
    }

    case 'tui': {
      const tui = new TUI();
      await tui.start();
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});