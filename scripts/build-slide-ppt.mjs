#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_INPUT = "docs/slides/catnovel-intro.marp.md";
const DEFAULT_OUTPUT = "docs/slides/catnovel-intro.pptx";

function readArg(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const inputPath = resolve(readArg("input") ?? DEFAULT_INPUT);
const outputPath = resolve(readArg("output") ?? DEFAULT_OUTPUT);

mkdirSync(dirname(outputPath), { recursive: true });

const result = spawnSync(
  "marp",
  [inputPath, "--pptx", "--output", outputPath],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      // 明确指定临时目录，减少跨环境差异带来的渲染失败。
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      TMP: process.env.TMP ?? "/tmp",
      TEMP: process.env.TEMP ?? "/tmp",
    },
  },
);

if (typeof result.status === "number" && result.status !== 0) {
  process.exit(result.status);
}

if (result.error) {
  console.error("[slides] 导出失败：", result.error.message);
  process.exit(1);
}

console.log(`[slides] PPT 已生成：${outputPath}`);
