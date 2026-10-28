import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source.
  transpilePackages: ["three", "@agent-world/core", "@agent-world/react"],
};

export default nextConfig;
