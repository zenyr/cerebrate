import { MCPClient } from "@cerebrate/client";
import type { MCPServerConfig } from "@cerebrate/core/protocol/types";
import { nanoid } from "nanoid";
import type { ChildProcess } from "node:child_process";

export interface TestClientOptions {
  /**
   * Server configuration to connect to
   */
  serverConfig: MCPServerConfig;

  /**
   * Scope name to register the server's tools under
   */
  scopeName?: string;

  /**
   * Client identifier for debugging
   */
  name?: string;
}

export interface TestClientInstance {
  /**
   * The MCP client instance
   */
  client: MCPClient;

  /**
   * Client identifier
   */
  id: string;

  /**
   * The scope name registered for this client
   */
  scopeName: string;

  /**
   * Whether the client is connected
   */
  isConnected: boolean;

  /**
   * Connect to the server
   */
  connect: () => Promise<void>;

  /**
   * Disconnect and cleanup
   */
  cleanup: () => Promise<void>;
}

/**
 * Creates an isolated MCP client instance for testing.
 * Each client connects to a specific server and registers its tools under a unique scope.
 *
 * @example
 * ```ts
 * const client = await createTestClient({
 *   serverConfig: {
 *     command: "node",
 *     args: ["server.js"],
 *     transport: "stdio"
 *   },
 *   scopeName: "test-server"
 * });
 *
 * await client.connect();
 *
 * // Use client...
 *
 * await client.cleanup();
 * ```
 */
export async function createTestClient(
  options: TestClientOptions
): Promise<TestClientInstance> {
  const id = nanoid(8);
  const scopeName = options.scopeName || `test-scope-${id}`;

  const client = new MCPClient(options.serverConfig);
  let isConnected = false;

  const connect = async () => {
    await client.connect();
    await client.registerScope(scopeName);
    isConnected = true;
  };

  const cleanup = async () => {
    if (isConnected) {
      await client.disconnect();
      isConnected = false;
    }
  };

  return {
    client,
    id,
    scopeName,
    isConnected,
    connect,
    cleanup,
  };
}

/**
 * Creates multiple isolated test client instances concurrently.
 *
 * @example
 * ```ts
 * const clients = await createTestClients([
 *   { serverConfig: {...}, scopeName: "server1" },
 *   { serverConfig: {...}, scopeName: "server2" },
 * ]);
 *
 * await Promise.all(clients.map(c => c.connect()));
 *
 * // Use clients...
 *
 * await Promise.all(clients.map(c => c.cleanup()));
 * ```
 */
export async function createTestClients(
  configs: TestClientOptions[]
): Promise<TestClientInstance[]> {
  return Promise.all(configs.map(config => createTestClient(config)));
}

/**
 * Creates a mock stdio MCP server process for testing.
 * This spawns a real Node process that implements the MCP protocol.
 *
 * @example
 * ```ts
 * const serverProcess = createMockStdioServer({
 *   tools: [{ name: "test", ... }],
 *   onToolCall: async (name, args) => {
 *     return { content: [{ type: "text", text: "result" }] };
 *   }
 * });
 *
 * // Create client that connects to this process
 * const client = await createTestClient({
 *   serverConfig: {
 *     command: "node",
 *     args: [serverProcess.scriptPath],
 *     transport: "stdio"
 *   }
 * });
 * ```
 */
export interface MockServerOptions {
  /**
   * Tools to expose from the mock server
   */
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;

  /**
   * Handler for tool calls
   */
  onToolCall: (name: string, args: unknown) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

/**
 * Helper to create a temporary stdio MCP server script for testing.
 * Returns the path to the script file.
 */
export async function createMockStdioServerScript(
  options: MockServerOptions
): Promise<string> {
  const tmpDir = await Bun.file("/tmp").exists() ? "/tmp" : process.cwd();
  const scriptPath = `${tmpDir}/mock-mcp-server-${nanoid(8)}.mjs`;

  const script = `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const tools = ${JSON.stringify(options.tools, null, 2)};

const server = new Server(
  {
    name: "mock-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler("initialize", async () => ({
  protocolVersion: "2024-11-05",
  capabilities: {
    tools: {},
  },
  serverInfo: {
    name: "mock-mcp-server",
    version: "1.0.0",
  },
}));

server.setRequestHandler("tools/list", async () => ({
  tools,
}));

server.setRequestHandler("tools/call", async (request) => {
  // In real implementation, call the handler
  return {
    content: [{ type: "text", text: "Mock result" }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
`;

  await Bun.write(scriptPath, script);
  return scriptPath;
}
