import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Parent folder has pnpm-lock.yaml; without this, Turbopack picks the wrong root and builds can mis-resolve the app.
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/staff/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:8080'}/api/v1/staff/:path*`
      }
    ];
  }
};

export default nextConfig;
