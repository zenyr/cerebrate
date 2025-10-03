import { ToolRegistry, type MCPServerConfig } from "@cerebrate/core/registry";
import { MCPServer } from "@cerebrate/server";
import { argsSchema, type CliArgs, type CliDeps } from "./types";
import { parseArgs } from "node:util";
import { PORT } from "@cerebrate/config";
import { loadConfig } from "./config";

export const printUsage = (): void => {
  console.log(`
Cerebrate MCP Server CLI

Usage:
  cerebrate [--transport stdio|http] [--port <port>] [--config <config-file>]

Options:
  --transport   Transport type: http (default) or stdio
  --port        Port for HTTP server (default: 3878)
  --config      Path to configuration file (JSON)
  --help        Show this help message
`);
};

export const runCli = async (
  args: CliArgs,
  deps: CliDeps = {}
): Promise<void> => {
  const parsed = argsSchema.parse(
    parseArgs({
      args,
      options: {
        transport: { type: "string", default: "http" },
        port: { type: "string" },
        config: { type: "string" },
        help: { type: "boolean" },
      },
    }).values
  );

  if (parsed.help) {
    printUsage();
    return;
  }

  const { transport, port: parsedPort = PORT, config: configPath } = parsed;
  const actualConfigPath = configPath; // loadConfig will handle default

  let port = parsedPort;
  if (transport === "stdio" && parsed.port !== undefined) {
    console.warn("--port option is ignored with --transport stdio");
    port = PORT;
  }

  // DI support
  const { ToolRegistryClass = ToolRegistry, MCPServerClass = MCPServer } = deps;

  const registry = new ToolRegistryClass();
  const server = new MCPServerClass(registry);

  // Load configuration from file (default or specified)
  const loadConfigFn = deps.loadConfig || loadConfig;
  const config = await loadConfigFn(actualConfigPath);

  const configs: MCPServerConfig[] = Object.entries(config.mcp || {}).map(([name, serverConfig]) => ({
    name,
    ...serverConfig,
  }));

  if (configs.length > 0) {
    await server.loadScopes(configs);
  }

  await server.start(transport, port);
};