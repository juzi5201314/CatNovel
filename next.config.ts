import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: [
    "@lancedb/lancedb",
    "@lancedb/lancedb-linux-x64-gnu",
    "@lancedb/lancedb-linux-x64-musl",
  ],
};

export default nextConfig;
