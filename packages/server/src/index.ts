import {
  ENABLE_TOOLS,
  LIST_AVAILABLE_SCOPES,
  ToolRegistry,
  type ToolName,
  type ScopeName,
  type MCPServerConfig,
} from "@cerebrate/core/registry";
import { MCPClient } from "@cerebrate/client";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export class MCPServer {
  private server: Server;
  private registry: ToolRegistry;
  private clients = new Map<ScopeName, MCPClient>();

  constructor(registry: ToolRegistry) {
    this.registry = registry;
    this.server = new Server(
      {
        name: "cerebrate",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private isValidParts(parts: string[]): parts is [string, string] {
    return parts.length === 2;
  }

  private parseToolName(toolName: string): { scope: string; tool: string } | null {
    const parts = toolName.split('/');
    if (this.isValidParts(parts)) {
      const [scope, tool] = parts;
      return { scope, tool };
    }
    return null;
  }

  private setupHandlers(): void {
    // Initialize handler
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      // TODO: Implement authentication check using ck-{nanoid}

      return {
        protocolVersion: request.params.protocolVersion,
        capabilities: {
          tools: {},
          // TODO: Add notifications capability if client supports it
        },
        serverInfo: {
          name: "cerebrate",
          version: "1.0.0",
        },
      };
    });

    // Tools list handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const exposedTools = this.registry.getExposedTools();
      const coreTools = [ENABLE_TOOLS, LIST_AVAILABLE_SCOPES];

      return {
        tools: [...coreTools, ...exposedTools],
      };
    });

    // Tools call handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Handle core tools
      if (name === "enableTools") {
        const scope = args?.scope as string;
        if (!scope) {
          throw new Error("scope parameter is required");
        }
        const success = this.registry.activateScope(scope);
        if (!success) {
          throw new Error(`Scope '${scope}' not found`);
        }
        // Send notifications/tools/list_changed
        this.server.notification({
          method: "notifications/tools/list_changed",
        });
        const usageGuide = this.registry.getToolUsageGuide(scope);
        return {
          content: [
            { type: "text", text: usageGuide || `Activated scope: ${scope}` },
          ],
        };
      }

      if (name === "listAvailableScopes") {
        const scopesInfo = this.registry.getAllScopesInfo();
        const text = scopesInfo
          .map(
            (scope) =>
              `Scope: ${scope.scope}\nServer: ${scope.serverInfo.name} v${
                scope.serverInfo.version
              }\nTools: ${scope.tools.map((t) => t.name).join(", ")}\n`
          )
          .join("\n");
        return {
          content: [{ type: "text", text: text || "No scopes available" }],
        };
      }

      // Handle namespaced tools
      const parsed = this.parseToolName(name);
      if (!parsed) {
        throw new Error(`Invalid tool name format: ${name}`);
      }
      const { scope, tool } = parsed;
      const scopeInfo = this.registry.getScopeByToolName(name as ToolName);
      if (!scopeInfo) {
        throw new Error(`Tool '${name}' not found or scope not activated`);
      }

      const client = this.clients.get(scope);
      if (!client) {
        throw new Error(`Client for scope '${scope}' not found`);
      }

      // Proxy to downstream MCP server
      return await client.callTool(tool, args);
    });

    // TODO: Implement notifications
  }

  async loadScopes(configs: MCPServerConfig[]): Promise<void> {
    for (const config of configs) {
      const client = new MCPClient(config, this.registry);
      await client.connect();
      await client.registerScope(config.name);
      this.clients.set(config.name, client);
      // Keep client connected for proxying
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("Cerebrate MCP server started");
  }

  async stop(): Promise<void> {
    await this.server.close();
  }
}
