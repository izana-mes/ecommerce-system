import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

/**
 * VNPAY server IPN (GET). Proxies to the Spring backend so order status, payment
 * rows, and paid-order emails are updated in one place (PostgreSQL + SMTP).
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  if (!query) {
    return NextResponse.json({ RspCode: "99", Message: "Invalid request" }, { status: 400 });
  }

  try {
    const backendRes = await fetch(`${API_URL}/payments/vnpay/ipn?${query}`, {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await backendRes.json().catch(() => ({
      rspCode: "99",
      message: "Invalid backend response",
    }));
    return NextResponse.json(body, { status: backendRes.ok ? 200 : 502 });
  } catch (error: unknown) {
    console.error(
      "VNPAY IPN proxy error:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ RspCode: "99", Message: "Unknown error" }, { status: 502 });
  }
}
