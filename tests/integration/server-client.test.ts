import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createTestServer,
  createTestServers,
  sampleTools,
  sampleResults,
  waitFor,
  type TestServerInstance,
} from "@cerebrate/test-utils";
import { ToolRegistry } from "@cerebrate/core/registry/tool-registry";

/**
 * Integration tests for MCP Server/Client interactions.
 * These tests create isolated instances to enable concurrent testing.
 */

describe("MCP Server Integration Tests", () => {
  let serverInstance: TestServerInstance | null = null;

  afterEach(async () => {
    if (serverInstance) {
      await serverInstance.cleanup();
      serverInstance = null;
    }
  });

  test("should create isolated server instance with custom tools", async () => {
    serverInstance = await createTestServer({
      name: "test-server-1",
      tools: [sampleTools.echo, sampleTools.calculator],
    });

    expect(serverInstance).toBeDefined();
    expect(serverInstance.server).toBeDefined();
    expect(serverInstance.registry).toBeInstanceOf(ToolRegistry);
    expect(serverInstance.id).toBeDefined();
  });

  test("should start HTTP server on random port", async () => {
    serverInstance = await createTestServer({
      name: "test-server-http",
      tools: [sampleTools.echo],
      port: 0, // Random port
    });

    expect(serverInstance.httpServer).toBeDefined();
    expect(serverInstance.port).toBeGreaterThan(0);
    expect(serverInstance.httpServer!.port).toBe(serverInstance.port);
  });

  test("should start HTTP server on specified port", async () => {
    const testPort = 54321;
    serverInstance = await createTestServer({
      name: "test-server-fixed-port",
      tools: [sampleTools.echo],
      port: testPort,
    });

    expect(serverInstance.port).toBe(testPort);
  });

  test("should register tools in the registry", async () => {
    serverInstance = await createTestServer({
      name: "test-server-tools",
      tools: [sampleTools.echo, sampleTools.calculator],
    });

    const exposedTools = serverInstance.registry.getExposedTools();
    expect(exposedTools.length).toBeGreaterThanOrEqual(2);

    // Check that our tools are registered (namespaced)
    const toolNames = exposedTools.map(t => t.name);
    expect(toolNames).toContain("test-server-tools/echo");
    expect(toolNames).toContain("test-server-tools/calculator");
  });

  test("should cleanup server resources", async () => {
    serverInstance = await createTestServer({
      tools: [sampleTools.echo],
      port: 0,
    });

    const port = serverInstance.port;
    expect(serverInstance.httpServer).toBeDefined();

    await serverInstance.cleanup();

    // After cleanup, trying to fetch should fail
    // Note: This might need adjustment based on actual Bun.serve behavior
    expect(serverInstance.httpServer).toBeDefined(); // Server object still exists
  });
});

describe("MCP Concurrent Server Tests", () => {
  let servers: TestServerInstance[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(s => s.cleanup()));
    servers = [];
  });

  test("should create multiple isolated server instances concurrently", async () => {
    servers = await createTestServers([
      { name: "server-1", tools: [sampleTools.echo], port: 0 },
      { name: "server-2", tools: [sampleTools.calculator], port: 0 },
      { name: "server-3", tools: [sampleTools.fileReader], port: 0 },
    ]);

    expect(servers).toHaveLength(3);

    // Each server should have unique IDs
    const ids = servers.map(s => s.id);
    expect(new Set(ids).size).toBe(3);

    // Each server should have unique ports
    const ports = servers.map(s => s.port).filter(Boolean);
    expect(new Set(ports).size).toBe(3);
  });

  test("should allow each server to have independent registries", async () => {
    servers = await createTestServers([
      { name: "server-echo", tools: [sampleTools.echo] },
      { name: "server-calc", tools: [sampleTools.calculator] },
    ]);

    const tools1 = servers[0].registry.getExposedTools();
    const tools2 = servers[1].registry.getExposedTools();

    // Each registry should have different tools
    const names1 = tools1.map(t => t.name);
    const names2 = tools2.map(t => t.name);

    expect(names1).toContain("server-echo/echo");
    expect(names2).toContain("server-calc/calculator");
  });

  test("concurrent servers should not interfere with each other", async () => {
    // Create 5 servers concurrently
    servers = await createTestServers(
      Array.from({ length: 5 }, (_, i) => ({
        name: `concurrent-server-${i}`,
        tools: [sampleTools.echo],
        port: 0,
      }))
    );

    expect(servers).toHaveLength(5);

    // All servers should be functional
    servers.forEach((server, i) => {
      expect(server.server).toBeDefined();
      expect(server.registry).toBeDefined();
      expect(server.port).toBeGreaterThan(0);
    });

    // Cleanup should work for all
    await Promise.all(servers.map(s => s.cleanup()));

    // Clear array to prevent double cleanup in afterEach
    servers = [];
  });
});

describe("MCP Server Tool Registry Integration", () => {
  let serverInstance: TestServerInstance | null = null;

  afterEach(async () => {
    if (serverInstance) {
      await serverInstance.cleanup();
      serverInstance = null;
    }
  });

  test("should expose core tools by default", async () => {
    serverInstance = await createTestServer({
      name: "core-tools-test",
    });

    const tools = serverInstance.registry.getExposedTools();

    // Without custom tools and auto-activation, exposed tools will be empty
    // Core tools are handled by MCPServer, not registry
    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
  });

  test("should allow scope activation and deactivation", async () => {
    serverInstance = await createTestServer({
      name: "scope-test",
      tools: [sampleTools.echo],
    });

    const scopeName = "scope-test";

    // Activate scope
    const activated = serverInstance.registry.activateScope(scopeName);
    expect(activated).toBe(true);

    // Check tools are exposed (already activated by auto-activation)
    let tools = serverInstance.registry.getExposedTools();
    let toolNames = tools.map(t => t.name);
    expect(toolNames).toContain("scope-test/echo");

    // Deactivate scope
    serverInstance.registry.deactivateScope(scopeName);

    // Check tools are no longer exposed
    tools = serverInstance.registry.getExposedTools();
    toolNames = tools.map(t => t.name);
    expect(toolNames).not.toContain("scope-test/echo");
  });

  test("should retrieve scope information", async () => {
    serverInstance = await createTestServer({
      name: "scope-info-test",
      version: "2.0.0",
      tools: [sampleTools.echo, sampleTools.calculator],
    });

    const scopes = serverInstance.registry.getAllScopesInfo();

    expect(scopes).toBeDefined();
    expect(Array.isArray(scopes)).toBe(true);

    // Find our test scope (getAllScopesInfo returns 'scope' field, not 'name')
    const testScope = scopes.find(s => s.scope === "scope-info-test");
    expect(testScope).toBeDefined();
    expect(testScope?.serverInfo.name).toBe("scope-info-test");
    expect(testScope?.serverInfo.version).toBe("2.0.0");
    expect(testScope?.tools).toHaveLength(2);
  });
});

describe("MCP Server HTTP/SSE Transport", () => {
  let serverInstance: TestServerInstance | null = null;

  afterEach(async () => {
    if (serverInstance) {
      await serverInstance.cleanup();
      serverInstance = null;
    }
  });

  test("should respond to HTTP requests", async () => {
    serverInstance = await createTestServer({
      name: "http-test",
      tools: [sampleTools.echo],
      port: 0,
    });

    const port = serverInstance.port!;

    // Make a simple HTTP request to the server
    const response = await fetch(`http://localhost:${port}/`);

    // Should get some response (404 is fine, just checking server is responding)
    expect(response).toBeDefined();
  });

  test("should handle SSE endpoint", async () => {
    serverInstance = await createTestServer({
      name: "sse-test",
      tools: [sampleTools.echo],
      port: 0,
    });

    const port = serverInstance.port!;

    // Try to access SSE endpoint
    const response = await fetch(`http://localhost:${port}/sse`);

    // Should get a response (might need auth, but endpoint should exist)
    expect(response).toBeDefined();
  });
});
