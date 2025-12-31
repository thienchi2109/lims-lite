import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable React Compiler for now due to invalid sourcemap noise in dev on Windows
  reactCompiler: false,
  experimental: {
    // Enable View Transitions API for smooth page transitions
    viewTransition: true,
    // Disable server source maps to avoid noisy invalid sourcemap warnings on Windows/dev
    serverSourceMaps: false,
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        ...(process.env.CODESPACE_NAME 
          ? [`${process.env.CODESPACE_NAME}-3000.app.github.dev`] 
          : [])
      ],
    },
  },
  // Enable standalone output for Docker deployments
  output: 'standalone',
};

export default nextConfig;
