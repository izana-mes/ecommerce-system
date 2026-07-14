import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

/**
 * BFF proxy: POST /api/paypal/create-order?orderNumber=ORD-...
 *
 * Forwards the request to the Spring Boot backend server-side.
 * The backend creates the PayPal order and returns a paypalOrderId.
 *
 * Security:
 * - Cookies (JWT) are forwarded to the backend for authenticated users.
 * - The PayPal client secret NEVER reaches the browser.
 */
export async function POST(request: NextRequest) {
  const orderNumber = request.nextUrl.searchParams.get("orderNumber");

  if (!orderNumber) {
    return NextResponse.json(
      { success: false, message: "orderNumber is required" },
      { status: 400 }
    );
  }

  // Forward JWT cookie from the browser to the backend
  const cookie = request.headers.get("cookie") ?? "";

  try {
    const backendRes = await fetch(
      `${API_URL}/payments/paypal/create-order?orderNumber=${encodeURIComponent(orderNumber)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        signal: AbortSignal.timeout(15_000),
      }
    );

    const body = await backendRes.json().catch(() => null);

    if (!backendRes.ok) {
      console.error(
        `[PayPal BFF] create-order failed: status=${backendRes.status}`,
        body
      );
      return NextResponse.json(
        { success: false, message: body?.message ?? "PayPal order creation failed" },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("[PayPal BFF] create-order error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to connect to payment service" },
      { status: 502 }
    );
  }
}
