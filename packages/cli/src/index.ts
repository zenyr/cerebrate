#!/usr/bin/env bun
import { ToolRegistry, type MCPServerConfig } from "@cerebrate/core/registry";
import { MCPServer } from "@cerebrate/server";
import { argsSchema, configSchema, type CliArgs, type CliDeps } from "./types";
import { parseArgs } from "node:util";
import { PORT } from "@cerebrate/config";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSON5 from "json5";

const getDefaultConfigPath = (): string => {
  const home = Bun.env.HOME;
  if (!home) throw new Error("HOME environment variable not set");
  return join(home, ".config", "cerebrate", "settings.json5");
};

const ensureConfigFile = (configPath: string): void => {
  const dir = join(configPath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({ mcp: {} }, null, 2));
  }
};

export const loadConfig = async (configPath?: string): Promise<import("./types").CerebrateConfig> => {
  const actualPath = configPath || getDefaultConfigPath();

  // Try .json5 first, then .json
  let configFilePath = actualPath;
  if (!existsSync(configFilePath)) {
    const jsonPath = configFilePath.replace(/\.json5?$/, ".json");
    if (existsSync(jsonPath)) {
      configFilePath = jsonPath;
    } else {
      // Auto-create default config if no --config specified
      if (!configPath) {
        ensureConfigFile(actualPath);
        configFilePath = actualPath;
      } else {
        throw new Error(`Config file not found: ${actualPath}`);
      }
    }
  }

  const configContent = await readFile(configFilePath, "utf-8");
  const config = JSON5.parse(configContent);
  return configSchema.parse(config);
};

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

  const { transport, port = PORT, config: configPath } = parsed;
  const actualConfigPath = configPath || getDefaultConfigPath();

  if (transport === "stdio" && parsed.port !== undefined) {
    console.error("Error: --port option is not valid with --transport stdio");
    process.exit(1);
  }

  // DI support
  const { ToolRegistryClass = ToolRegistry, MCPServerClass = MCPServer } = deps;

  const registry = new ToolRegistryClass();
  const server = new MCPServerClass(registry);

  // Load configuration from file (default or specified)
  const loadConfigFn = deps.loadConfig || loadConfig;
  let config: import("./types").CerebrateConfig;
  try {
    config = await loadConfigFn(actualConfigPath);
  } catch (error) {
    console.error(`Error loading config file:`, error);
    process.exit(1);
  }

  const configs: MCPServerConfig[] = Object.entries(config.mcp || {}).map(([name, serverConfig]) => ({
    name,
    ...serverConfig,
  }));

  if (configs.length > 0) {
    await server.loadScopes(configs);
  }

  await server.start(transport, port);
};

async function main(): Promise<void> {
  const args: CliArgs = process.argv.slice(2);
  await runCli(args);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
