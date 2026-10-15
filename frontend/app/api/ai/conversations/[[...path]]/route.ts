import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

async function proxy(request: Request, method: "GET" | "DELETE", context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  const suffix = path.map(encodeURIComponent).join("/");
  try {
    const upstream = await fetch(`${backendApiBaseUrl()}/ai/conversations${suffix ? `/${suffix}` : ""}`, {
      method,
      headers: { ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : {}), ...(request.headers.get("authorization") ? { authorization: request.headers.get("authorization")! } : {}) },
      cache: "no-store"
    });
    if (upstream.status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(await upstream.json().catch(() => ({ error: "AI service unavailable" })), { status: upstream.status });
  } catch { return NextResponse.json({ error: "AI service unavailable" }, { status: 503 }); }
}
export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) { return proxy(request, "GET", context); }
export async function DELETE(request: Request, context: { params: Promise<{ path?: string[] }> }) { return proxy(request, "DELETE", context); }
