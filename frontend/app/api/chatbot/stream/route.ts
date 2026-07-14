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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const upstream = await fetch(`${backendApiBaseUrl()}/chatbot/staff/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ question }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const data = await upstream.text().catch(() => "Backend error");
      return NextResponse.json({ error: data || "Backend error" }, { status: upstream.status || 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout
          ? "The staff assistant is taking too long to respond. Please try again."
          : "The staff assistant is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
