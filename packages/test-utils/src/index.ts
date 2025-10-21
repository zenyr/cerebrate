/**
 * @cerebrate/test-utils
 *
 * Utilities for testing MCP servers and clients with isolated instances.
 * Enables concurrent testing by creating independent server/client pairs.
 *
 * @example
 * ```ts
 * import { createTestServer, createTestClient, sampleTools } from "@cerebrate/test-utils";
 *
 * // Create isolated server instance
 * const server = await createTestServer({
 *   tools: [sampleTools.echo],
 *   port: 0, // Random port
 * });
 *
 * // Create client connected to this server
 * const client = await createTestClient({
 *   serverConfig: {
 *     url: `http://localhost:${server.port}/sse`,
 *     transport: "sse",
 *   },
 * });
 *
 * await client.connect();
 *
 * // Test...
 *
 * // Cleanup
 * await client.cleanup();
 * await server.cleanup();
 * ```
 */

export {
  createTestServer,
  createTestServers,
  type TestServerOptions,
  type TestServerInstance,
} from "./test-server";

export {
  createTestClient,
  createTestClients,
  createMockStdioServerScript,
  type TestClientOptions,
  type TestClientInstance,
  type MockServerOptions,
} from "./test-client";

export {
  sampleTools,
  sampleResults,
  sampleServerConfigs,
  mockToolHandlers,
  waitFor,
  delay,
} from "./fixtures";
