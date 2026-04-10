import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

export const repoRoot = path.resolve(currentDir, '../../..');

export const PRODUCT_ROOTS = [
  'app',
  'components',
  'db',
  'docs',
  'lib',
  'public',
  'scripts',
  'tests',
];

export const RUNTIME_ROOTS = ['app', 'components', 'db', 'lib', 'public'];

const ignoredDirectoryNames = new Set([
  '.git',
  '.next',
  '.omx',
  'coverage',
  'node_modules',
]);

export function resolveFromRepo(...segments) {
  return path.join(repoRoot, ...segments);
}

export function repoPathExists(...segments) {
  return fs.existsSync(resolveFromRepo(...segments));
}

export function listExistingRoots(roots) {
  return roots.filter((root) => repoPathExists(root));
}

export function walkFiles(rootRelativePath) {
  const absoluteRoot = resolveFromRepo(rootRelativePath);

  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const files = [];
  const queue = [absoluteRoot];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absoluteEntry = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name)) {
          queue.push(absoluteEntry);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push(path.relative(repoRoot, absoluteEntry));
      }
    }
  }

  return files.sort();
}

export function readTextFiles(rootRelativePaths) {
  const results = [];

  for (const rootRelativePath of rootRelativePaths) {
    for (const relativeFilePath of walkFiles(rootRelativePath)) {
      results.push({
        relativeFilePath,
        content: fs.readFileSync(resolveFromRepo(relativeFilePath), 'utf8'),
      });
    }
  }

  return results;
}
