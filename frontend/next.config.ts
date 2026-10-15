import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Parent folder has pnpm-lock.yaml; without this, Turbopack picks the wrong root and builds can mis-resolve the app.
  turbopack: {
    root: path.join(__dirname)},
  async rewrites() {
    const isProd = process.env.NODE_ENV === "production";
    const backend =
      process.env.BACKEND_URL ||
      (isProd ? process.env.NEXT_PUBLIC_BACKEND_URL : undefined) ||
      "http://localhost:8080";
    return [
      {
        source: "/login/oauth2/code/:path*",
        destination: `${backend}/login/oauth2/code/:path*`,
      },
      {
        source: "/oauth2/:path*",
        destination: `${backend}/oauth2/:path*`,
      },
      {
        source: "/api/v1/staff/:path*",
        destination: `${backend}/api/v1/staff/:path*`},
      {
        source: "/api/v1/shipper/:path*",
        destination: `${backend}/api/v1/shipper/:path*`},
      {
        source: "/api/v1/supplier/:path*",
        destination: `${backend}/api/v1/supplier/:path*`},
      // Route handlers under app/api take precedence over these fallbacks.  The
      // remaining Spring endpoints (and payment provider callbacks) therefore
      // stay available through the single public frontend origin.
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`},
      // SockJS transports must use the same public origin as the frontend when
      // the backend has no host-published port.
      {
        source: "/ws/:path*",
        destination: `${backend}/ws/:path*`},
    ];
  }
};

export default nextConfig;
