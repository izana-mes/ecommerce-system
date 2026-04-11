import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Parent folder has pnpm-lock.yaml; without this, Turbopack picks the wrong root and builds can mis-resolve the app.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
