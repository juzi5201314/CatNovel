import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const rootDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  turbopack: {
    root: rootDir,
  },
  // 让 pi-ai 包保持外部，避免 Turbopack 无法分析其动态导入
  serverExternalPackages: [
    "@mariozechner/pi-ai",
    "@mariozechner/pi-agent-core",
  ],
};

export default nextConfig;
