import JSON5 from "json5";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EMPTY_CONFIG, getDefaultConfigPath } from "./consts";
import { configSchema, type CerebrateConfig } from "./types";

const ensureConfigFile = async (configPath: string): Promise<void> => {
  const dir = join(configPath, "..");
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(configPath, JSON5.stringify(EMPTY_CONFIG, null, 2), {
      flag: "wx",
    });
  } catch {
    // 파일이 이미 존재하면 무시
  }
};

export const loadConfig = async (
  configPath?: string
): Promise<CerebrateConfig> => {
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
