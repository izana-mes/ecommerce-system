import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

function getCookieHeader(request: Request) {
  return request.headers.get("cookie");
}

export async function GET(request: Request) {
  try {
        const cookieHeader = getCookieHeader(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const query = status ? `?status=${encodeURIComponent(status)}` : "";

    const response = await fetch(`${backendApiBaseUrl()}/attendance/reviews${query}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",        ...(cookieHeader ? { Cookie: cookieHeader } : {})},
      cache: "no-store"});

    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch performance reviews.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
