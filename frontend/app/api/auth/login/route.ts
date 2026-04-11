import { NextResponse } from "next/server";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rateLimit";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(request, "auth-login", 10, 60_000);
    if (!limit.ok) {
      return createRateLimitResponse("Too many login attempts. Please try again shortly.", limit.retryAfterSeconds);
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/v1/auth/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error during login:", error?.message || error);
    return NextResponse.json(
      {
        error: "Failed to login",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
