#!/usr/bin/env bun

// @cerebrate/cli를 직접 import하여 번들링
import { main } from "@cerebrate/cli";

main(process.argv.slice(2)).catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
