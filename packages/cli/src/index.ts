#!/usr/bin/env bun
import { runCli } from "./cli";
import type { CliArgs } from "./types";

const main = async (): Promise<void> => {
  const args: CliArgs = process.argv.slice(2);
  await runCli(args);
};

if (import.meta.main) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
