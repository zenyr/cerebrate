import { ToolRegistry } from "@cerebrate/core/registry";
import { expect, mock, test } from "bun:test";
import { MCPServer } from "./index";

// Mock MCP SDK
const mockServer = {
  setRequestHandler: mock(() => {}),
  notification: mock(() => {}),
  connect: mock(() => Promise.resolve()),
  close: mock(() => Promise.resolve()),
};

mock.module("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: mock(() => mockServer),
}));

mock.module("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: mock(() => ({})),
}));

mock.module("@modelcontextprotocol/sdk/types.js", () => ({
  InitializeRequestSchema: "initialize",
  ListToolsRequestSchema: "listTools",
  CallToolRequestSchema: "callTool",
}));

test("MCPServer constructor initializes server and sets up handlers", () => {
  const registry = new ToolRegistry();

  const server = new MCPServer(registry);

  expect(server).toBeDefined();
   expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(5); // initialize, listTools, callTool, listResources, readResource
});

test("MCPServer start calls server.connect", async () => {
  const registry = new ToolRegistry();

  const server = new MCPServer(registry);
  await server.start();

  expect(mockServer.connect).toHaveBeenCalled();
});

test("MCPServer stop calls server.close", async () => {
  const registry = new ToolRegistry();

  const server = new MCPServer(registry);
  await server.stop();

  expect(mockServer.close).toHaveBeenCalled();
});

test("MCPServer loadScopes registers clients", async () => {
  const registry = new ToolRegistry();

  // Mock client
  const mockClient = {
    connect: mock(() => Promise.resolve()),
    registerScope: mock(() => Promise.resolve()),
  };

  mock.module("@cerebrate/client", () => ({
    MCPClient: mock(() => mockClient),
  }));

  const server = new MCPServer(registry);
  const configs = [{ name: "test", command: "echo", args: ["test"] }];

  await server.loadScopes(configs);

  expect(mockClient.connect).toHaveBeenCalled();
  expect(mockClient.registerScope).toHaveBeenCalledWith("test");
});

 test("MCPServer createHonoApp returns app with fetch and port", () => {
   const registry = new ToolRegistry();
   const server = new MCPServer(registry);

   const app = server.createHonoApp(3000);

   expect(app).toHaveProperty("fetch");
   expect(typeof app.fetch).toBe("function");
   expect(app.port).toBe(3000);
 });

 test("HTTP transport handles initialize request", async () => {
   const registry = new ToolRegistry();
   const server = new MCPServer(registry);

   const app = server.createHonoApp(3000);

   const response = await app.fetch(new Request('http://localhost:3000/mcp', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       jsonrpc: '2.0',
       id: 1,
       method: 'initialize',
       params: { protocolVersion: '2024-11-05' }
     })
   }));

   expect(response.status).toBe(200);
   const result = await response.json() as any;
   expect(result.jsonrpc).toBe('2.0');
   expect(result.id).toBe(1);
   expect(result.result).toHaveProperty('protocolVersion');
   expect(result.result.serverInfo.name).toBe('cerebrate');
 });

 test("HTTP transport handles tools/list request", async () => {
   const registry = new ToolRegistry();
   const server = new MCPServer(registry);

   const app = server.createHonoApp(3000);

   const response = await app.fetch(new Request('http://localhost:3000/mcp', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       jsonrpc: '2.0',
       id: 2,
       method: 'tools/list',
       params: {}
     })
   }));

   expect(response.status).toBe(200);
   const result = await response.json() as any;
   expect(result.jsonrpc).toBe('2.0');
   expect(result.id).toBe(2);
   expect(result.result).toHaveProperty('tools');
   expect(Array.isArray(result.result.tools)).toBe(true);
 });

 test("HTTP transport returns 404 for unknown method", async () => {
   const registry = new ToolRegistry();
   const server = new MCPServer(registry);

   const app = server.createHonoApp(3000);

   const response = await app.fetch(new Request('http://localhost:3000/mcp', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       jsonrpc: '2.0',
       id: 3,
       method: 'unknown/method',
       params: {}
     })
   }));

   expect(response.status).toBe(404);
   const result = await response.json() as any;
   expect(result.jsonrpc).toBe('2.0');
   expect(result.error.code).toBe(-32601);
 });

// Note: Handler tests would require more complex mocking of the server internals
// For now, we test the basic setup. Integration tests will cover full functionality.
