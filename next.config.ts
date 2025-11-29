import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable React Compiler for now due to invalid sourcemap noise in dev on Windows
  reactCompiler: false,
  experimental: {
    // Disable server source maps to avoid noisy invalid sourcemap warnings on Windows/dev
    serverSourceMaps: false,
  },
  // Enable standalone output for Docker deployments
  output: 'standalone',
};

export default nextConfig;
