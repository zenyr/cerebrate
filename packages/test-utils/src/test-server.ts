import type { Server as BunServer } from "bun";
import { MCPServer } from "@cerebrate/server";
import { ToolRegistry } from "@cerebrate/core/registry/tool-registry";
import type { Tool } from "@cerebrate/core/protocol/types";
import { nanoid } from "nanoid";

export interface TestServerOptions {
  /**
   * Custom tools to register on the server
   */
  tools?: Tool[];

  /**
   * Custom port for HTTP/SSE transport (defaults to random port)
   */
  port?: number;

  /**
   * Server name for identification
   */
  name?: string;

  /**
   * Server version
   */
  version?: string;
}

export interface TestServerInstance {
  /**
   * The MCP server instance
   */
  server: MCPServer;

  /**
   * The tool registry
   */
  registry: ToolRegistry;

  /**
   * The HTTP server (if using HTTP/SSE transport)
   */
  httpServer?: BunServer;

  /**
   * The port the server is listening on (if using HTTP/SSE)
   */
  port?: number;

  /**
   * Server identifier
   */
  id: string;

  /**
   * Clean up and shutdown the server
   */
  cleanup: () => Promise<void>;
}

/**
 * Creates an isolated MCP server instance for testing.
 * Each instance gets its own ToolRegistry and can be configured independently.
 *
 * @example
 * ```ts
 * const instance = await createTestServer({
 *   tools: [
 *     {
 *       name: "test_tool",
 *       description: "A test tool",
 *       inputSchema: { type: "object", properties: {} }
 *     }
 *   ],
 *   port: 0 // Random available port
 * });
 *
 * // Use the server...
 *
 * // Cleanup when done
 * await instance.cleanup();
 * ```
 */
export async function createTestServer(
  options: TestServerOptions = {}
): Promise<TestServerInstance> {
  const id = nanoid(8);
  const registry = new ToolRegistry();

  // Register custom tools if provided
  if (options.tools) {
    registry.registerScope({
      name: options.name || `test-server-${id}`,
      serverInfo: {
        name: options.name || `test-server-${id}`,
        version: options.version || "1.0.0",
      },
      tools: options.tools,
      serverConfig: {
        command: "test",
        args: [],
        transport: "stdio" as const,
      },
    });
  }

  const server = new MCPServer(registry);

  let httpServer: BunServer | undefined;
  let actualPort: number | undefined;

  // Start HTTP server if port is specified
  if (options.port !== undefined) {
    const port = options.port === 0 ? getRandomPort() : options.port;

    httpServer = Bun.serve({
      port,
      fetch: server.app.fetch,
    });

    actualPort = httpServer.port;
  }

  const cleanup = async () => {
    if (httpServer) {
      httpServer.stop(true);
    }
    // Additional cleanup if needed
  };

  return {
    server,
    registry,
    httpServer,
    port: actualPort,
    id,
    cleanup,
  };
}

/**
 * Get a random available port for testing
 */
function getRandomPort(): number {
  // Use a random port in the ephemeral range (49152-65535)
  // to avoid conflicts with system ports and common application ports
  return Math.floor(Math.random() * (65535 - 49152 + 1)) + 49152;
}

/**
 * Creates multiple isolated test server instances concurrently.
 * Useful for testing multiple server scenarios in parallel.
 *
 * @example
 * ```ts
 * const instances = await createTestServers([
 *   { name: "server1", tools: [...] },
 *   { name: "server2", tools: [...] },
 * ]);
 *
 * // Use servers...
 *
 * // Cleanup all
 * await Promise.all(instances.map(i => i.cleanup()));
 * ```
 */
export async function createTestServers(
  configs: TestServerOptions[]
): Promise<TestServerInstance[]> {
  return Promise.all(configs.map(config => createTestServer(config)));
}
