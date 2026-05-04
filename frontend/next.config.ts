import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Parent folder has pnpm-lock.yaml; without this, Turbopack picks the wrong root and builds can mis-resolve the app.
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    const isProd = process.env.NODE_ENV === "production";
    const backend =
      process.env.BACKEND_URL ||
      (isProd ? process.env.NEXT_PUBLIC_BACKEND_URL : undefined) ||
      "http://localhost:8080";
    return [
      {
        source: "/api/v1/staff/:path*",
        destination: `${backend}/api/v1/staff/:path*`,
      },
      {
        source: "/api/v1/shipper/:path*",
        destination: `${backend}/api/v1/shipper/:path*`,
      },
      {
        source: "/api/v1/supplier/:path*",
        destination: `${backend}/api/v1/supplier/:path*`,
      },
    ];
  }
};

export default nextConfig;
