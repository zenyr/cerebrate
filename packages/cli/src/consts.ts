import { join } from "node:path";
import type { CerebrateConfig } from "./types";

export const EMPTY_CONFIG = { mcpServers: {} } satisfies CerebrateConfig;

export const getDefaultConfigPath = (): string => {
  const home = Bun.env.HOME;
  if (!home) throw new Error("HOME environment variable not set");
  return join(home, ".config", "cerebrate", "settings.json5");
};
