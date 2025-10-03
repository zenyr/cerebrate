import type { ToolRegistry } from "@cerebrate/core/registry";
import type { MCPServer } from "@cerebrate/server";
import z from "zod";

export interface CliDeps {
  ToolRegistryClass?: typeof ToolRegistry;
  MCPServerClass?: typeof MCPServer;
  loadConfig?: (configPath?: string) => Promise<CerebrateConfig>;
}

export type CliArgs = string[];

export const argsSchema = z.object({
  help: z.boolean().optional(),
  transport: z.enum(["stdio", "http"]).optional().default("http"),
  port: z
    .string()
    .optional()
    .refine((val) => val === undefined || /^\d+$/.test(val), {
      message: "Port must be a valid number",
    })
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().min(1).max(65535).optional()),
  config: z.string().optional(),
});

// Configuration file schema for MCP servers
export const configSchema = z.object({
  mcpServers: z
    .record(
      z.string(),
      z.object({
        command: z.string(),
        args: z.array(z.string()).optional(),
        env: z.record(z.string(), z.string()).optional(),
      })
    )
    .optional(),
});

export type CerebrateConfig = z.infer<typeof configSchema>;

// For testing purposes
export interface TestCliDeps {
  ToolRegistryClass?: typeof ToolRegistry;
  MCPServerClass?: typeof MCPServer;
  mockServer: MCPServer;
  loadConfig?: (configPath?: string) => Promise<CerebrateConfig>;
}
