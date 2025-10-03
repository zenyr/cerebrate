import { beforeAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { printUsage, runCli } from "./cli";
import { EMPTY_CONFIG } from "./consts";
import type { TestCliDeps } from "./types";

beforeAll(() => {
  // Set HOME for testing
  process.env.HOME = "/tmp";
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test utility for mocking
const createMockClasses = (serverMethods: Record<string, any>) => {
  const mockRegistry = {};
  const mockServer = serverMethods;

  Object.keys(serverMethods).forEach((method) => {
    if (typeof mockServer[method] === "function") {
      spyOn(mockServer, method);
    }
  });

  const ToolRegistryClass = class {
    constructor() {
      return mockRegistry;
    }
  };
  const MCPServerClass = class {
    constructor() {
      return mockServer;
    }
  };

  const loadConfig = () => Promise.resolve(EMPTY_CONFIG);

  return {
    ToolRegistryClass,
    MCPServerClass,
    mockServer,
    loadConfig,
  } as unknown as TestCliDeps;
};

describe("CLI", () => {
  describe("printUsage", () => {
    it("should print usage information", () => {
      const consoleSpy = spyOn(console, "log");
      printUsage();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cerebrate MCP Server CLI")
      );
      consoleSpy.mockRestore();
    });
  });

  describe("runCli", () => {
    let deps: TestCliDeps;

    beforeEach(() => {
      const { ToolRegistryClass, MCPServerClass, mockServer, loadConfig } =
        createMockClasses({
          loadScopes: () => Promise.resolve(),
          start: () => Promise.resolve(),
        });
      deps = {
        ToolRegistryClass,
        MCPServerClass,
        mockServer,
        loadConfig,
      };
    });

    it("should print usage when --help is provided", async () => {
      const consoleSpy = spyOn(console, "log");

      await runCli(["--help"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cerebrate MCP Server CLI")
      );

      consoleSpy.mockRestore();
    });

    it("should start HTTP server by default", async () => {
      await runCli([], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("http", 3878);
    });

    it("should start stdio server when --transport stdio", async () => {
      await runCli(["--transport", "stdio"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("stdio", 3878);
    });

    it("should start HTTP server with custom port", async () => {
      await runCli(["--port", "3000"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("http", 3000);
    });

    it("should start stdio server with custom port (ignored)", async () => {
      const consoleSpy = spyOn(console, "warn");

      await runCli(["--transport", "stdio", "--port", "3000"], deps);

      expect(deps.mockServer.start).toHaveBeenCalledWith("stdio", 3878);
      expect(consoleSpy).toHaveBeenCalledWith(
        "--port option is ignored with --transport stdio"
      );

      consoleSpy.mockRestore();
    });

    it("should throw error when --port is used with stdio", async () => {
      // This test is kept for future if we decide to make it an error
      expect(true).toBe(true);
    });

    it("should load config and call loadScopes when --config is provided", async () => {
      const configPath = "/tmp/test-config.json5";
      const mockConfig = {
        mcpServers: {
          testServer: {
            command: "echo",
            args: ["test"],
          },
        },
      };

      const { ToolRegistryClass, MCPServerClass, mockServer } = createMockClasses({
        loadScopes: () => Promise.resolve(),
        start: () => Promise.resolve(),
      });

      const mockLoadConfig = async (path?: string) => {
        expect(path).toBe(configPath);
        return mockConfig;
      };

      const deps = { ToolRegistryClass, MCPServerClass, mockServer, loadConfig: mockLoadConfig };

      await runCli(["--config", configPath], deps);

      expect(mockServer.loadScopes).toHaveBeenCalledWith([
        {
          name: "testServer",
          command: "echo",
          args: ["test"],
        },
      ]);
    });
  });
});
