#!/usr/bin/env bun
import { runCli } from "./cli";
import type { CliArgs } from "./types";

export const main = async (args?: CliArgs): Promise<void> => {
  const cliArgs = args ?? process.argv.slice(2);
  await runCli(cliArgs);
};

if (import.meta.main) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
