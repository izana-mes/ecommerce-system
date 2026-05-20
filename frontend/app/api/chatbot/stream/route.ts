import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = String(body.question || "").trim();
  if (!question) return NextResponse.json({ error: "Question is required" }, { status: 400 });

    if (!cookieHeader) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const upstream = await fetch(`${backendApiBaseUrl()}/chatbot/staff/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: cookieHeader,
      Accept: "text/event-stream"},
    body: JSON.stringify({ question }),
    cache: "no-store"});

  if (!upstream.ok || !upstream.body) {
    const data = await upstream.text().catch(() => "Backend error");
    return NextResponse.json({ error: data || "Backend error" }, { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"}});
}
