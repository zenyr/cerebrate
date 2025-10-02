import { describe, it, expect, spyOn, beforeEach } from "bun:test";
import {
  printUsage,
  handleServerCommand,
  handleHttpServerCommand,
  handleTuiCommand,
  runCli,
} from "./index";
import type { TestCliDeps, MockServer } from "./types";

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

  describe("handleServerCommand", () => {
    let deps: TestCliDeps;

    beforeEach(() => {
      const { ToolRegistryClass, MCPServerClass, mockServer } =
        createMockClasses({
          loadScopes: () => Promise.resolve(),
          start: () => Promise.resolve(),
        });
      deps = {
        ToolRegistryClass,
        MCPServerClass,
        mockServer: mockServer as MockServer,
      };
    });

    it("should start server with default options", async () => {
      await handleServerCommand([], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("stdio", 3878);
    });

    it("should start server with http transport", async () => {
      await handleServerCommand(["--transport", "http"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("http", 3878);
    });

    it("should start server with custom port", async () => {
      await handleServerCommand(["--port", "3000"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("stdio", 3000);
    });
  });

  describe("handleHttpServerCommand", () => {
    let deps: TestCliDeps;

    beforeEach(() => {
      const { ToolRegistryClass, MCPServerClass, mockServer } =
        createMockClasses({
          loadScopes: () => Promise.resolve(),
          createHonoApp: () => ({ fetch: () => {} }),
        });
      deps = {
        ToolRegistryClass,
        MCPServerClass,
        mockServer: mockServer as MockServer,
      };
    });

    it("should start HTTP server with default port", async () => {
      const consoleSpy = spyOn(console, "log");
      const bunServeSpy = spyOn(Bun, "serve").mockImplementation(
        () => ({} as any)
      );

      await handleHttpServerCommand([], deps);

      expect(deps.mockServer.createHonoApp).toHaveBeenCalledWith(3878);
      expect(bunServeSpy).toHaveBeenCalledWith({
        port: 3878,
        fetch: expect.any(Function),
      });

      consoleSpy.mockRestore();
      bunServeSpy.mockRestore();
    });

    it("should start HTTP server with custom port", async () => {
      const consoleSpy = spyOn(console, "log");
      const bunServeSpy = spyOn(Bun, "serve").mockImplementation(
        () => ({} as any)
      );

      await handleHttpServerCommand(["--port", "3000"], deps);

      expect(deps.mockServer.createHonoApp).toHaveBeenCalledWith(3000);
      expect(bunServeSpy).toHaveBeenCalledWith({
        port: 3000,
        fetch: expect.any(Function),
      });

      consoleSpy.mockRestore();
      bunServeSpy.mockRestore();
    });
  });

  describe("handleTuiCommand", () => {
    it("should start TUI", async () => {
      const consoleSpy = spyOn(console, "log");

      await handleTuiCommand();

      expect(consoleSpy).toHaveBeenCalledWith("🚀 Cerebrate TUI starting...");
      expect(consoleSpy).toHaveBeenCalledWith(
        'TUI not yet implemented. Use "cerebrate server" or "cerebrate http-server" instead.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe("runCli", () => {
    it("should print usage when no args", async () => {
      const consoleSpy = spyOn(console, "log");

      await runCli([]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cerebrate MCP Server CLI")
      );

      consoleSpy.mockRestore();
    });

    it("should print usage when --help is provided", async () => {
      const consoleSpy = spyOn(console, "log");

      await runCli(["--help"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cerebrate MCP Server CLI")
      );

      consoleSpy.mockRestore();
    });

    it("should throw error for unknown command", async () => {
      const consoleSpy = spyOn(console, "error");

      await expect(runCli(["unknown"])).rejects.toThrow(
        "Unknown command: unknown"
      );

      expect(consoleSpy).toHaveBeenCalledWith("Unknown command: unknown");

      consoleSpy.mockRestore();
    });
  });
});
