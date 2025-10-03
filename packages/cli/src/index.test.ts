import { describe, it, expect, spyOn, beforeEach, beforeAll } from "bun:test";
import { printUsage, runCli } from "./index";

beforeAll(() => {
  // Set HOME for testing
  process.env.HOME = "/tmp";
});

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

  return { ToolRegistryClass, MCPServerClass, mockServer };
};

describe("CLI", () => {
  describe("loadConfig", () => {
    // TODO: Fix mocking for loadConfig tests with JSON5 support
    it.skip("should load and parse config file", () => {
      // Test implementation pending
    });

    it.skip("should return empty array when no mcp config", () => {
      // Test implementation pending
    });

    it.skip("should auto-create config file if not exists", () => {
      // Test implementation pending
    });
  });

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
    let deps: any;

    beforeEach(() => {
      const { ToolRegistryClass, MCPServerClass, mockServer } =
        createMockClasses({
          loadScopes: () => Promise.resolve(),
          start: () => Promise.resolve(),
        });
      deps = { ToolRegistryClass, MCPServerClass, mockServer, loadConfig: async () => ({ mcp: {} }) };
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
      const args = ["--config", "/tmp/.config/cerebrate/settings.json5"];
      const parsedArgs = require("node:util").parseArgs({
        args,
        options: {
          transport: { type: "string", default: "http" },
          port: { type: "string" },
          config: { type: "string" },
          help: { type: "boolean" },
        },
      });
      console.log("args:", args);
      console.log("parsedArgs.values:", parsedArgs.values);
      await runCli(args, deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("http", 3878);
    });

    it("should start stdio server when --transport stdio", async () => {
      await runCli(["--transport", "stdio", "--config", "/tmp/.config/cerebrate/settings.json5"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("stdio", 3878);
    });

    it("should start HTTP server with custom port", async () => {
      await runCli(["--port", "3000", "--config", "/tmp/.config/cerebrate/settings.json5"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("http", 3000);
    });

    it("should start stdio server with custom port (ignored)", async () => {
      await runCli(["--transport", "stdio", "--port", "3000", "--config", "/tmp/.config/cerebrate/settings.json5"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("stdio", 3878);
    });

    it("should exit with error when --port is used with stdio", async () => {
      const consoleSpy = spyOn(console, "error");
      const exitSpy = spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      expect(
        runCli(["--transport", "stdio", "--port", "3000", "--config", "/tmp/.config/cerebrate/settings.json5"])
      ).rejects.toThrow("process.exit called");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error: --port option is not valid with --transport stdio"
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it.skip("should load config and call loadScopes when --config is provided", async () => {
      // Test implementation pending - need proper mocking
    });
  });
});
