import { NextResponse } from "next/server";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rateLimit";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(request, "auth-resend-otp", 5, 10 * 60_000);
    if (!limit.ok) {
      return createRateLimitResponse("Too many OTP resend attempts. Please try again later.", limit.retryAfterSeconds);
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/v1/auth/resend-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"},
      body: JSON.stringify(body)});

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error(
      "Error resending OTP:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      {
        error: "Failed to resend OTP",
        details: error instanceof Error ? error.message : String(error)},
      { status: 500 }
    );
  }
}
