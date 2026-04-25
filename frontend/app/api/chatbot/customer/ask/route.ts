import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

/**
 * Thin proxy — forwards chatbot questions to the Spring Boot backend on Render.
 * The backend has direct DB access and handles all intent logic.
 * This approach works on Vercel (no direct DB connection needed).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = String(body.question || "").trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  // Forward the auth header so logged-in users get order-lookup enrichment.
  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  const guestId = request.headers.get("x-guest-id");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const backendUrl = `${backendApiBaseUrl()}/chatbot/customer/ask`;
    const upstream = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(guestId ? { "x-guest-id": guestId } : {}),
      },
      body: JSON.stringify({
        question,
        conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      }),
      signal: controller.signal,
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error || "Backend error", ...(data as object) },
        { status: upstream.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        intent: "service_unavailable",
        answer: isTimeout
          ? "The assistant is taking too long to respond. Please try again in a moment."
          : "The assistant is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
