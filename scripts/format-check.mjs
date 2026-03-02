#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const includeRoots = ["scripts", "docs"];
const includeFiles = ["package.json"];
const allowedExtensions = new Set([".mjs", ".md", ".json"]);

function walk(dir) {
  const output = [];
  if (!fs.existsSync(dir)) {
    return output;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...walk(fullPath));
      continue;
    }
    output.push(fullPath);
  }
  return output;
}

function collectTargetFiles() {
  const files = [];
  for (const file of includeFiles) {
    const fullPath = path.join(root, file);
    if (fs.existsSync(fullPath)) {
      files.push(fullPath);
    }
  }
  for (const dir of includeRoots) {
    const dirPath = path.join(root, dir);
    for (const file of walk(dirPath)) {
      if (allowedExtensions.has(path.extname(file))) {
        files.push(file);
      }
    }
  }
  return files.sort();
}

function checkFile(fullPath) {
  const errors = [];
  const content = fs.readFileSync(fullPath, "utf8");
  const relativePath = path.relative(root, fullPath);

  if (content.length > 0 && !content.endsWith("\n")) {
    errors.push(`${relativePath}: missing trailing newline`);
  }

  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/[ \t]+$/.test(line)) {
      errors.push(`${relativePath}:${index + 1}: trailing whitespace`);
    }
  }

  return errors;
}

function main() {
  const files = collectTargetFiles();
  const errors = [];

  for (const file of files) {
    errors.push(...checkFile(file));
  }

  if (errors.length > 0) {
    console.error("format_check_ok=false");
    for (const error of errors) {
      console.error(error);
    }
    process.exitCode = 1;
    return;
  }

  console.log("format_check_ok=true");
  console.log(`checked_files=${files.length}`);
}

main();
