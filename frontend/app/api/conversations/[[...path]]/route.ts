import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_BASE_URL = backendApiBaseUrl().replace(/\/+$/, "");

function getForwardHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (auth) headers["Authorization"] = auth;
  const cookie = request.headers.get("cookie");
  if (cookie) headers["Cookie"] = cookie;
  const guest = request.headers.get("x-guest-id");
  if (guest) headers["x-guest-id"] = guest;
  const ct = request.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  return headers;
}

async function proxy(request: NextRequest, paramsPromise: Promise<{ path?: string[] }>) {
  const { path } = await paramsPromise;
  const subPath = path && path.length > 0 ? "/" + path.map(encodeURIComponent).join("/") : "";
  const url = new URL(request.url);
  const targetUrl = `${API_BASE_URL}/conversations${subPath}${url.search}`;

  const headers = getForwardHeaders(request);
  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text().catch(() => undefined);
  }

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });

    const text = await res.text();
    return new NextResponse(text || null, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: "Backend proxy error", details: String(err) }, { status: 502 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, params);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, params);
}
