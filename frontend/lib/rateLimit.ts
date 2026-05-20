import { NextResponse } from "next/server";

type Bucket = {
  timestamps: number[];
};

type RateLimitResult = {
  ok: boolean;
  retryAfterSeconds: number;
};

declare global {
  var __apiRateLimiter: Map<string, Bucket> | undefined;
}

function getStore(): Map<string, Bucket> {
  if (!globalThis.__apiRateLimiter) {
    globalThis.__apiRateLimiter = new Map<string, Bucket>();
  }
  return globalThis.__apiRateLimiter;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = (forwarded?.split(",")[0] || realIp || "127.0.0.1").trim();
  return ip || "127.0.0.1";
}

export function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const ip = getClientIp(request);
  const key = `${scope}:${ip}`;
  const store = getStore();
  const bucket = store.get(key) || { timestamps: [] };

  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

  if (bucket.timestamps.length >= limit) {
    store.set(key, bucket);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)) };
  }

  bucket.timestamps.push(now);
  store.set(key, bucket);
  return { ok: true, retryAfterSeconds: 0 };
}

export function createRateLimitResponse(message: string, retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: message,
      retryAfterSeconds},
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds)}}
  );
}
