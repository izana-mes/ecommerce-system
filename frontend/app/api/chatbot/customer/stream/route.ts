import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = String(body.question || "").trim();
  if (!question) return NextResponse.json({ error: "Question is required" }, { status: 400 });

  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  const cookieHeader = request.headers.get("cookie");
  const guestId = request.headers.get("x-guest-id");

  const upstream = await fetch(`${backendApiBaseUrl()}/chatbot/customer/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(guestId ? { "x-guest-id": guestId } : {}),
      Accept: "text/event-stream"},
    body: JSON.stringify({
      question,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined}),
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
