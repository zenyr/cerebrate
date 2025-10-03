import { existsSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import JSON5 from "json5";
import { configSchema, type CerebrateConfig } from "./types";
import { EMPTY_CONFIG } from "./consts";

const getDefaultConfigPath = (): string => {
  const home = Bun.env.HOME;
  if (!home) throw new Error("HOME environment variable not set");
  return join(home, ".config", "cerebrate", "settings.json5");
};

const ensureConfigFile = async (configPath: string): Promise<void> => {
  const dir = join(configPath, "..");
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(configPath, JSON5.stringify(EMPTY_CONFIG, null, 2), { flag: 'wx' });
  } catch {
    // 파일이 이미 존재하면 무시
  }
};

export const loadConfig = async (configPath?: string): Promise<CerebrateConfig> => {
  const actualPath = configPath || getDefaultConfigPath();
  const jsonPath = actualPath.replace(/\.json5?$/, ".json");

  if (configPath && !existsSync(actualPath)) {
    throw new Error(`Config file not found: ${actualPath}`);
  }

  if (!configPath && !existsSync(actualPath) && !existsSync(jsonPath)) {
    await ensureConfigFile(actualPath);
  }

  let configFilePath = actualPath;
  if (!existsSync(configFilePath)) {
    configFilePath = jsonPath;
  }

  const configContent = await readFile(configFilePath, "utf-8");
  const config = JSON5.parse(configContent);
  return configSchema.parse(config);
};