import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "connected";
  let dbLatencyMs = 0;
  let dbError = "";

  try {
    const conn = await getConnection();
    const dbStart = Date.now();
    await conn.execute("SELECT 1 AS ping");
    dbLatencyMs = Date.now() - dbStart;
    await conn.end();
  } catch (err: unknown) {
    dbStatus = "error";
    dbError = err instanceof Error ? err.message : String(err);
  }

  const mem = process.memoryUsage();
  const uptimeSeconds = process.uptime();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    responseTimeMs: Date.now() - startTime,
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      error: dbError || undefined,
    },
    memory: {
      heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      externalMB: Math.round((mem.external / 1024 / 1024) * 100) / 100,
    },
    process: {
      uptimeSeconds: Math.round(uptimeSeconds),
      uptimeFormatted: formatUptime(uptimeSeconds),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || "development",
      dbClient: process.env.DB_CLIENT || "mysql",
      dbHost: process.env.DB_HOST || "localhost",
    },
  });
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}
