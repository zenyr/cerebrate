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
  expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(3); // initialize, listTools, callTool
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

// Note: Handler tests would require more complex mocking of the server internals
// For now, we test the basic setup. Integration tests will cover full functionality.
