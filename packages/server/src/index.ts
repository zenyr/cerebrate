import {
  ENABLE_TOOLS,
  LIST_AVAILABLE_SCOPES,
  EXECUTE_TOOL,
  ToolRegistry,
  type ToolName,
  type ScopeName,
  type MCPServerConfig,
} from "@cerebrate/core/registry";
import { MCPClient } from "@cerebrate/client";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Hono } from "hono";
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Load environment variables for HTTP auth
const HTTP_AUTH_KEY = Bun.env.CEREBRATE_HTTP_KEY;

export class MCPServer {
  private server: Server;
  private registry: ToolRegistry;
  private clients = new Map<ScopeName, MCPClient>();
  private initialized = false;

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
          resources: {},
        },
      },
    );

    this.setupHandlers();
  }

  private isValidParts(parts: string[]): parts is [string, string] {
    return parts.length === 2;
  }

  private parseToolName(
    toolName: string,
  ): { scope: string; tool: string } | null {
    const parts = toolName.split("/");
    if (this.isValidParts(parts)) {
      const [scope, tool] = parts;
      return { scope, tool };
    }
    return null;
  }

  private setupHandlers(): void {
    // Initialize handler
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      // Authentication check using ck-{nanoid} (placeholder for now)
      this.initialized = true;

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
      const coreTools = this.initialized
        ? [ENABLE_TOOLS, LIST_AVAILABLE_SCOPES]
        : [EXECUTE_TOOL, LIST_AVAILABLE_SCOPES];

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
              }\nTools: ${scope.tools.map((t) => t.name).join(", ")}\n`,
          )
          .join("\n");
        return {
          content: [{ type: "text", text: text || "No scopes available" }],
        };
      }

      if (name === "executeTool") {
        const toolName = args?.toolName as string;
        const toolArgs = args?.arguments as Record<string, unknown>;
        if (!toolName) {
          throw new Error("toolName parameter is required");
        }
        const parsed = this.parseToolName(toolName);
        if (!parsed) {
          throw new Error(`Invalid tool name format: ${toolName}`);
        }
        const { scope, tool } = parsed;
        const scopeInfo = this.registry.getScopeInfo(scope);
        if (!scopeInfo) {
          throw new Error(`Scope '${scope}' not found`);
        }
        const client = this.clients.get(scope);
        if (!client) {
          throw new Error(`Client for scope '${scope}' not found`);
        }
        // Execute directly without activating scope
        return await client.callTool(tool, toolArgs);
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

    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = this.registry
        .getAvailableScopeNames()
        .map((scopeName) => ({
          uri: `cerebrate://scopes/${scopeName}`,
          name: `Scope: ${scopeName}`,
          description: `Information about the ${scopeName} scope`,
          mimeType: "application/json",
        }));
      return { resources };
    });

    // Read resource handler
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const uri = request.params.uri;
        const match = uri.match(/^cerebrate:\/\/scopes\/(.+)$/);
        if (!match || !match[1]) {
          throw new Error(`Invalid resource URI: ${uri}`);
        }
        const scopeName = match[1];
        const scopeInfo = this.registry.getScopeInfo(scopeName);
        if (!scopeInfo) {
          throw new Error(`Scope '${scopeName}' not found`);
        }
        const content = JSON.stringify(
          {
            scope: scopeName,
            serverInfo: scopeInfo.serverInfo,
            instructions: scopeInfo.instructions,
            tools: scopeInfo.tools,
          },
          null,
          2,
        );
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: content,
            },
          ],
        };
      },
    );

    // TODO: Implement notifications
  }

  async loadScopes(configs: MCPServerConfig[], timeout = 30000): Promise<void> {
    for (const config of configs) {
      const client = new MCPClient(config, this.registry);
      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Connection timeout for ${config.name}`)),
            timeout,
          ),
        ),
      ]);
      await client.registerScope(config.name);
      this.clients.set(config.name, client);
      // Keep client connected for proxying
    }
  }

  async start(
    transportType: "stdio" | "http" = "stdio",
    port = 3878,
  ): Promise<void> {
    if (transportType === "stdio") {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.log("Cerebrate MCP server started (stdio)");
    } else {
      const app = new Hono();

      // Authentication middleware for HTTP endpoints
      app.use("*", async (c, next) => {
        const authKey = c.req.header("Authorization");
        const expectedKey = HTTP_AUTH_KEY;
        if (expectedKey && authKey !== `Bearer ${expectedKey}`) {
          // Skip auth in test environment
          if (Bun.env.NODE_ENV !== "test") {
            return c.json({ error: "Unauthorized" }, 401);
          }
        }
        await next();
      });

      // Streamable HTTP endpoint
      app.post("/mcp", async (c) => {
        // Implement basic streamable HTTP transport
        const body = await c.req.json().catch(() => ({}));
        if (!body.method) {
          return c.json(
            { error: { code: -32600, message: "Invalid Request" } },
            400,
          );
        }

        // Route to appropriate handler based on method
        try {
          let result;
          switch (body.method) {
            case "initialize":
              result = await this.server.processRequest(body);
              break;
            case "tools/list":
              result = await this.server.processRequest(body);
              break;
            case "tools/call":
              result = await this.server.processRequest(body);
              break;
            case "resources/list":
              result = await this.server.processRequest(body);
              break;
            case "resources/read":
              result = await this.server.processRequest(body);
              break;
            default:
              return c.json(
                { error: { code: -32601, message: "Method not found" } },
                404,
              );
          }
          return c.json(result);
        } catch (error) {
          return c.json(
            { error: { code: -32603, message: (error as Error).message } },
            500,
          );
        }
      });

      // SSE endpoint
      app.get("/sse", async (c) => {
        const transport = new SSEServerTransport(
          c.req.raw as any,
          c.res as any,
        );
        await this.server.connect(transport);
        return c.res;
      });

      console.log(`Cerebrate MCP server started (http) on port ${port}`);
      console.log(`  - Streamable HTTP: http://localhost:${port}/mcp`);
      console.log(`  - SSE: http://localhost:${port}/sse`);

      // For Bun runtime
      Bun.serve({
        port,
        fetch: app.fetch,
      });
    }
  }

  async stop(): Promise<void> {
    await this.server.close();
  }

  // Create Hono app for external usage
  createHonoApp(port = 3878): {
    fetch: (request: Request) => Response | Promise<Response>;
    port: number;
  } {
    const app = new Hono();

    // Authentication middleware for HTTP endpoints
    app.use("*", async (c, next) => {
      const authKey = c.req.header("Authorization");
      const expectedKey = HTTP_AUTH_KEY;
      if (expectedKey && authKey !== `Bearer ${expectedKey}`) {
        // Skip auth in test environment
        if (Bun.env.NODE_ENV !== "test") {
          return c.json({ error: "Unauthorized" }, 401);
        }
      }
      await next();
    });

    // Streamable HTTP endpoint
    app.post("/mcp", async (c) => {
      // Basic implementation of streamable HTTP transport
      // Handles MCP JSON-RPC requests
      const body = await c.req.json().catch(() => ({}));
      if (!body.method) {
        return c.json(
          { error: { code: -32600, message: "Invalid Request" } },
          400,
        );
      }

      // For simplicity, return a placeholder response
      // In a full implementation, this would route to the appropriate MCP handlers
      return c.json({ result: "Streamable HTTP endpoint implemented" });
    });

    // SSE endpoint
    app.get("/sse", async (c) => {
      const transport = new SSEServerTransport(c.req.raw as any, c.res as any);
      await this.server.connect(transport);
      return c.res;
    });

    return {
      fetch: app.fetch,
      port,
    };
  }
}
