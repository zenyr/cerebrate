import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import JSON5 from "json5";
import { exists, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "./config";
import { EMPTY_CONFIG } from "./consts";
import type { CerebrateConfig } from "./types";

describe("Config", () => {
  const originalHome = process.env.HOME;
  const testHome = "/tmp/test-cerebrate";

  beforeEach(() => {
    process.env.HOME = testHome;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    // Clean up test files
    const configDir = join(testHome, ".config", "cerebrate");
    const json5Path = join(configDir, "settings.json5");
    const jsonPath = join(configDir, "settings.json");
    if (await exists(json5Path)) await unlink(json5Path);
    if (await exists(jsonPath)) await unlink(jsonPath);
  });

  describe("loadConfig", () => {
    it("should load and parse existing config file", async () => {
      const configPath = join(
        testHome,
        ".config",
        "cerebrate",
        "settings.json5"
      );
      const configDir = join(configPath, "..");

      // Create test config directory and file
      await mkdir(configDir, { recursive: true });
      const testConfig = {
        mcpServers: { test: { command: "echo", args: ["hello"] } },
      };
      await writeFile(configPath, JSON5.stringify(testConfig, null, 2));

      const result = await loadConfig(configPath);
      expect(result).toEqual(testConfig);
    });

    it("should auto-create config file if not exists", async () => {
      const configPath = join(
        testHome,
        ".config",
        "cerebrate",
        "settings.json5"
      );

      // Ensure file doesn't exist
      if (await exists(configPath)) {
        await unlink(configPath);
      }

      const result = await loadConfig();
      expect(result).toEqual(EMPTY_CONFIG);

      // Verify file was created
      expect(exists(configPath)).resolves.toBe(true);
      const content = await readFile(configPath, "utf-8");
      expect(JSON5.parse(content) as CerebrateConfig).toEqual(EMPTY_CONFIG);
    });

    it("should throw error when config file not found and custom path provided", async () => {
      const nonExistentPath = "/non/existent/config.json5";

      expect(loadConfig(nonExistentPath)).rejects.toThrow(
        `Config file not found: ${nonExistentPath}`
      );
    });

    it("should handle JSON5 parsing errors", async () => {
      const configPath = join(
        testHome,
        ".config",
        "cerebrate",
        "settings.json5"
      );
      const configDir = join(configPath, "..");

      // Create directory and invalid JSON5 file
      await mkdir(configDir, { recursive: true });
      await writeFile(configPath, "invalid json5 content {");

      expect(loadConfig(configPath)).rejects.toThrow();
    });

    it("should prefer .json5 over .json when both exist", async () => {
      const basePath = join(testHome, ".config", "cerebrate", "settings");
      const json5Path = `${basePath}.json5`;
      const jsonPath = `${basePath}.json`;
      const configDir = join(json5Path, "..");

      await mkdir(configDir, { recursive: true });

      const json5Config = {
        mcpServers: { test1: { command: "echo", args: ["json5"] } },
      };
      const jsonConfig = {
        mcpServers: { test2: { command: "echo", args: ["json"] } },
      };

      await writeFile(json5Path, JSON5.stringify(json5Config, null, 2));
      await writeFile(jsonPath, JSON.stringify(jsonConfig, null, 2));

      const result = await loadConfig();
      expect(result).toEqual(json5Config);
    });

    it("should fall back to .json if .json5 doesn't exist", async () => {
      const basePath = join(testHome, ".config", "cerebrate", "settings");
      const json5Path = `${basePath}.json5`;
      const jsonPath = `${basePath}.json`;
      const configDir = join(jsonPath, "..");

      await mkdir(configDir, { recursive: true });

      // Remove json5 if exists
      if (await exists(json5Path)) {
        await unlink(json5Path);
      }

      const jsonConfig = { mcpServers: { test: { command: "echo", args: ["json"] } } };
      await writeFile(jsonPath, JSON.stringify(jsonConfig, null, 2));

      const result = await loadConfig();
      expect(result).toEqual(jsonConfig);
    });
  });
});
