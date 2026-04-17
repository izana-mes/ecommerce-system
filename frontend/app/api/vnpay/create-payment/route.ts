import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rateLimit";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function POST(request: NextRequest) {
  const limit = checkRateLimit(request, "payment-vnpay-create", 20, 5 * 60_000);
  if (!limit.ok) {
    return createRateLimitResponse("Too many payment requests. Please try again shortly.", limit.retryAfterSeconds);
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const cookieHeader = request.headers.get("cookie");
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");

    const backendResponse = await fetch(`${API_URL}/vnpay/create-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
        ...(realIp ? { "X-Real-IP": realIp } : {}),
      },
      body: JSON.stringify(body),
    });

    const rawText = await backendResponse.text();
    let data: unknown = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { message: rawText };
      }
    }

    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error: unknown) {
    console.error(
      "Error proxying VNPAY create-payment:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ error: "Payment service unavailable" }, { status: 502 });
  }
}
