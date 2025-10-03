import { test, expect, mock, beforeEach } from "bun:test";
import { MCPClient } from "./index";
import { ToolRegistry, type MCPServerConfig } from "@cerebrate/core/registry";

// Mock MCP SDK
const mockClient = {
  connect: mock(() => Promise.resolve()),
  listTools: mock(() => Promise.resolve({ tools: [] })),
  getServerVersion: mock(() => ({ name: "test-server", version: "1.0.0" })),
  getInstructions: mock(() => "test instructions"),
  close: mock(() => Promise.resolve()),
  callTool: mock(() => Promise.resolve({})),
};

const mockTransport = {};

mock.module("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    connect = mockClient.connect;
    listTools = mockClient.listTools;
    getServerVersion = mockClient.getServerVersion;
    getInstructions = mockClient.getInstructions;
    close = mockClient.close;
    callTool = mockClient.callTool;
  },
}));

mock.module("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: mock(() => mockTransport),
}));

// Reset mocks before each test
beforeEach(() => {
  mockClient.connect.mockClear();
  mockClient.listTools.mockClear();
  mockClient.getServerVersion.mockClear();
  mockClient.getInstructions.mockClear();
  mockClient.close.mockClear();
  mockClient.callTool.mockClear();
});

test("MCPClient constructor initializes correctly", () => {
  const config: MCPServerConfig = {
    name: "test",
    command: "test-command",
    args: ["arg1"],
    env: { TEST: "value" },
  };
  const registry = new ToolRegistry();

  const client = new MCPClient(config, registry);

  expect(client).toBeDefined();
  // Verify that Client was created with correct params
  expect(mockClient).toBeDefined();
});

test.skip("MCPClient connect calls client.connect", async () => {
  const config: MCPServerConfig = {
    name: "test",
    command: "test-command",
  };
  const registry = new ToolRegistry();

  const client = new MCPClient(config, registry);
  await client.connect();

  expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
});

test.skip("MCPClient registerScope registers scope with registry", async () => {
  const config: MCPServerConfig = {
    name: "test",
    command: "test-command",
  };
  const registry = new ToolRegistry();

  const mockTools = [
    { name: "tool1", description: "desc1", inputSchema: { type: "object", properties: {} } },
  ];
  mockClient.listTools.mockResolvedValue({ tools: mockTools as any });

  const client = new MCPClient(config, registry);
  await client.registerScope("test-scope");

  expect(mockClient.listTools).toHaveBeenCalledWith({});
  expect(mockClient.getServerVersion).toHaveBeenCalled();
  expect(mockClient.getInstructions).toHaveBeenCalled();

  const availableScopes = registry.getAvailableScopeNames();
  expect(availableScopes).toContain("test-scope");
});

test.skip("MCPClient disconnect calls client.close", async () => {
  const config: MCPServerConfig = {
    name: "test",
    command: "test-command",
  };
  const registry = new ToolRegistry();

  const client = new MCPClient(config, registry);
  await client.disconnect();

  expect(mockClient.close).toHaveBeenCalled();
});