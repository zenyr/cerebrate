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

    it("should print usage when no subcommand", async () => {
      const consoleSpy = spyOn(console, "log");

      await runCli([]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cerebrate MCP Server CLI")
      );

      consoleSpy.mockRestore();
    });

    it("should start HTTP server with http-server command", async () => {
      await runCli(["http-server"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("http", 3878);
    });

    it("should start stdio server with server command", async () => {
      await runCli(["server"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("stdio", 3878);
    });

    it("should start HTTP server with custom port", async () => {
      await runCli(["http-server", "--port", "3000"], deps);
      expect(deps.mockServer.start).toHaveBeenCalledWith("http", 3000);
    });

    it("should ignore port with server command", async () => {
      const consoleSpy = spyOn(console, "warn");

      await runCli(["server", "--port", "3000"], deps);

      expect(deps.mockServer.start).toHaveBeenCalledWith("stdio", 3878);
      expect(consoleSpy).toHaveBeenCalledWith(
        "--port option is ignored with server command"
      );

      consoleSpy.mockRestore();
    });

    it("should handle tui command", async () => {
      // Mock child_process.spawn
      const mockSpawn = spyOn(await import("child_process"), "spawn").mockReturnValue({
        on: (event: string, callback: (code?: number) => void) => {
          if (event === "close") callback(0);
        },
      } as any);

      // Mock exit to prevent actual exit
      deps.exit = () => {};

      await runCli(["tui"], deps);

      expect(mockSpawn).toHaveBeenCalledWith("bun", ["run", "--filter", "@cerebrate/tui", "start"], {
        stdio: "inherit",
        cwd: process.cwd(),
      });

      mockSpawn.mockRestore();
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

      await runCli(["http-server", "--config", configPath], deps);

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
