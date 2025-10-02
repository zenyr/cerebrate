import { describe, it, expect, spyOn, beforeEach } from "bun:test";
import { printUsage, runCli } from "./index";

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
    let deps: { ToolRegistryClass: any; MCPServerClass: any; mockServer: any };

    beforeEach(() => {
      const { ToolRegistryClass, MCPServerClass, mockServer } =
        createMockClasses({
          loadScopes: () => Promise.resolve(),
          start: () => Promise.resolve(),
        });
      deps = { ToolRegistryClass, MCPServerClass, mockServer };
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
      await runCli(["--transport", "stdio", "--port", "3000"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("stdio", 3878);
    });

    it("should exit with error when --port is used with stdio", async () => {
      const consoleSpy = spyOn(console, "error");
      const exitSpy = spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      await expect(
        runCli(["--transport", "stdio", "--port", "3000"])
      ).rejects.toThrow("process.exit called");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error: --port option is not valid with --transport stdio"
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});
