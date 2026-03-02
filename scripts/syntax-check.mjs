#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const scriptsDir = path.join(root, "scripts");

function main() {
  const files = fs
    .readdirSync(scriptsDir)
    .filter((name) => name.endsWith(".mjs"))
    .sort();

  for (const name of files) {
    const fullPath = path.join(scriptsDir, name);
    const result = spawnSync(process.execPath, ["--check", fullPath], {
      stdio: "pipe",
      encoding: "utf8",
    });
    if (result.status !== 0) {
      process.stderr.write(`syntax_check_ok=false\n`);
      process.stderr.write(`file=${name}\n`);
      process.stderr.write(result.stderr);
      process.exit(result.status ?? 1);
    }
  }

  console.log("syntax_check_ok=true");
  console.log(`checked_files=${files.length}`);
}

main();
