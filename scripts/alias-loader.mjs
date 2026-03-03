import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = "/home/soeur/project/CatNovel";
const srcRoot = path.join(projectRoot, "src");

function resolveAliasToFile(specifier) {
  return resolveBaseToFile(path.join(srcRoot, specifier.slice(2)));
}

function resolveBaseToFile(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
    path.join(base, "index.mjs"),
  ];
  return candidates.find((candidate) => {
    if (!fs.existsSync(candidate)) {
      return false;
    }
    return fs.statSync(candidate).isFile();
  });
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolvedPath = resolveAliasToFile(specifier);
    if (resolvedPath) {
      return {
        url: pathToFileURL(resolvedPath).href,
        shortCircuit: true,
      };
    }
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL);
    const base = path.resolve(path.dirname(parentPath), specifier);
    const resolvedPath = resolveBaseToFile(base);
    if (resolvedPath) {
      return {
        url: pathToFileURL(resolvedPath).href,
        shortCircuit: true,
      };
    }
  }

  return nextResolve(specifier, context);
}
