#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const detectBun = (): string | null => {
  try {
    const result = spawnSync("bun", ["--version"], { encoding: "utf-8" });
    if (result.status === 0) {
      const version = result.stdout.trim();
      const [major, minor] = version.split(".").map(Number);
      // YAML 네이티브 모듈은 Bun 1.2+
      if (major > 1 || (major === 1 && minor >= 2)) {
        return version;
      }
    }
  } catch {}
  return null;
};

const runWithBun = (args: string[]) => {
  const nativePath = join(__dirname, "native.js");
  const result = spawnSync("bun", ["run", nativePath, ...args], {
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
};

const runCompiled = (args: string[]) => {
  const platform = `${process.platform}-${process.arch}`;
  const BINARY_MAP: Record<string, string> = {
    "darwin-arm64": "@cerebrate/cli-darwin-arm64",
    "darwin-x64": "@cerebrate/cli-darwin-x64",
    "linux-x64": "@cerebrate/cli-linux-x64",
    "linux-arm64": "@cerebrate/cli-linux-arm64",
    "win32-x64": "@cerebrate/cli-windows-x64",
  };

  const pkgName = BINARY_MAP[platform];
  if (!pkgName) {
    console.error(`❌ Unsupported platform: ${platform}`);
    console.error("Supported:", Object.keys(BINARY_MAP).join(", "));
    process.exit(1);
  }

  try {
    const ext = process.platform === "win32" ? ".exe" : "";
    const binaryPath = require.resolve(`${pkgName}/bin/cerebrate${ext}`);
    const result = spawnSync(binaryPath, args, { stdio: "inherit" });
    process.exit(result.status ?? 1);
  } catch (error) {
    console.error(`❌ Binary not found for ${platform}`);
    console.error("Try: npm install -g cerebrate --force");
    process.exit(1);
  }
};

const main = (args: string[]) => {
  // 환경변수 BUN이 truthy면 Bun 직접 실행
  if (process.env.BUN) {
    const bunVersion = detectBun();
    if (bunVersion) {
      console.log(`🚀 Using Bun ${bunVersion}`);
      return runWithBun(args);
    }
    console.warn(
      "⚠️  BUN env is set but Bun not found, using compiled binary"
    );
  }

  // 기본: 컴파일된 바이너리
  return runCompiled(args);
};

main(process.argv.slice(2));
