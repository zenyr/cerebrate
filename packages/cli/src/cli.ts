import { PORT } from "@cerebrate/config";
import { ToolRegistry, type MCPServerConfig } from "@cerebrate/core/registry";
import { MCPServer } from "@cerebrate/server";
import { parseArgs } from "node:util";
import { loadConfig } from "./config";
import { argsSchema, type CliArgs, type CliDeps } from "./types";

export const printUsage = (): void => {
  console.log(`
Cerebrate MCP Server CLI

Usage:
  cerebrate <command> [options]

Commands:
  server       Start MCP server with stdio transport
  http-server  Start MCP server with HTTP transport
  tui          Start terminal UI for monitoring

Options:
  --port        Port for HTTP server (default: 3878)
  --config      Path to configuration file (JSON5)
  --help        Show this help message
`);
};

export const runCli = async (
  args: CliArgs,
  deps: CliDeps = {}
): Promise<void> => {
  const parsedArgs = parseArgs({
    args,
    options: {
      port: { type: "string" },
      config: { type: "string" },
      help: { type: "boolean" },
    },
    allowPositionals: true,
  });

  const parsed = argsSchema.parse({
    subCommand: parsedArgs.positionals[0],
    port: parsedArgs.values.port,
    config: parsedArgs.values.config,
    help: parsedArgs.values.help,
    positionals: parsedArgs.positionals,
  });

  if (parsed.help || !parsed.subCommand) {
    printUsage();
    return;
  }

  const subCommand = parsed.subCommand;

  const { port: parsedPort = PORT, config: configPath } = parsed;
  const actualConfigPath = configPath; // loadConfig will handle default

  let transport: "stdio" | "http";
  let port = parsedPort;

  switch (subCommand) {
    case "server":
      transport = "stdio";
      if (parsed.port !== undefined) {
        console.warn("--port option is ignored with server command");
        port = PORT;
      }
      break;
    case "http-server":
      transport = "http";
      break;
    case "tui":
      // TUI는 아직 구현되지 않음
      console.log("TUI not implemented yet");
      return;
    default:
      printUsage();
      return;
   }

   // DI support
  const { ToolRegistryClass = ToolRegistry, MCPServerClass = MCPServer } = deps;

  const registry = new ToolRegistryClass();
  const server = new MCPServerClass(registry);

  // Load configuration from file (default or specified)
  const loadConfigFn = deps.loadConfig || loadConfig;
  const config = await loadConfigFn(actualConfigPath);

  const configs: MCPServerConfig[] = Object.entries(config.mcpServers || {}).map(
    ([name, serverConfig]) => ({
      name,
      ...serverConfig,
    })
  );

  if (configs.length > 0) {
    await server.loadScopes(configs);
  }

  await server.start(transport, port);
};
