import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const message = String(body.message || "").trim();
  if (!message || message.length > 2000) return NextResponse.json({ error: "A message up to 2000 characters is required" }, { status: 400 });
  try {
    const upstream = await fetch(`${backendApiBaseUrl()}/ai/ask`, { method: "POST", headers: { "Content-Type": "application/json", ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : {}), ...(request.headers.get("authorization") ? { authorization: request.headers.get("authorization")! } : {}) }, body: JSON.stringify({ message, productId: typeof body.productId === "string" ? body.productId : undefined, conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined }), cache: "no-store" });
    return NextResponse.json(await upstream.json().catch(() => ({ error: "AI service unavailable" })), { status: upstream.status });
  } catch { return NextResponse.json({ error: "AI service unavailable" }, { status: 503 }); }
}
