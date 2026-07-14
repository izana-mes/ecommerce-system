import { NextResponse } from "next/server";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rateLimit";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(request, "auth-reset-password", 8, 10 * 60_000);
    if (!limit.ok) {
      return createRateLimitResponse("Too many password reset attempts. Please try again later.", limit.retryAfterSeconds);
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/v1/auth/reset-password`, {
      method: "POST",
      headers: backendAuthHeaders(request),
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error(
      "Error resetting password:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      {
        error: "Failed to reset password",
        details: error instanceof Error ? error.message : String(error)},
      { status: 500 }
    );
  }
}
