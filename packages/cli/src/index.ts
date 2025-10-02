#!/usr/bin/env bun
import { ToolRegistry } from "@cerebrate/core/registry";
import { MCPServer } from "@cerebrate/server";
import type { CliArgs } from "./types";

export const printUsage = (): void => {
  console.log(`
Cerebrate MCP Server CLI

Usage:
  cerebrate [--transport stdio|http] [--port <port>]

Options:
  --transport   Transport type: http (default) or stdio
  --port        Port for HTTP server (default: 3878, ignored for stdio)
  --help        Show this help message
`);
};

export const runCli = async (
  args: CliArgs,
  deps: {
    ToolRegistryClass?: typeof ToolRegistry;
    MCPServerClass?: typeof MCPServer;
  } = {}
): Promise<void> => {
  if (args.includes("--help")) {
    printUsage();
    return;
  }

  const transportIndex = args.indexOf("--transport");
  const portIndex = args.indexOf("--port");

  const transport =
    transportIndex !== -1 &&
    transportIndex + 1 < args.length &&
    args[transportIndex + 1] === "stdio"
      ? "stdio"
      : "http";
  const portArg =
    portIndex !== -1 && portIndex + 1 < args.length
      ? args[portIndex + 1]
      : undefined;
  const port = portArg ? parseInt(portArg) : 3878;

  if (transport === "stdio" && portArg !== undefined) {
    console.error("Error: --port option is not valid with --transport stdio");
    process.exit(1);
  }

  const { ToolRegistryClass = ToolRegistry, MCPServerClass = MCPServer } = deps;

  const registry = new ToolRegistryClass();
  const server = new MCPServerClass(registry);

  // TODO: Load configuration from file
  const configs: any[] = [];

  if (configs.length > 0) {
    await server.loadScopes(configs);
  }

  await server.start(transport, port);
};

async function main(): Promise<void> {
  const args: CliArgs = process.argv.slice(2);
  await runCli(args);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
