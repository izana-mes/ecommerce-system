import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

/**
 * BFF proxy: POST /api/paypal/capture-order
 *
 * Called immediately after the PayPal JS SDK's onApprove callback.
 * Forwards the paypalOrderId + orderNumber to Spring Boot for server-side capture.
 *
 * Security:
 * - Amount is validated on the backend against the DB — never from the client.
 * - JWT cookie is forwarded for authenticated ownership check.
 * - We NEVER trust the frontend's claim that a payment succeeded.
 */
export async function POST(request: NextRequest) {
  let body: { paypalOrderId?: string; orderNumber?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!body.paypalOrderId || !body.orderNumber) {
    return NextResponse.json(
      { success: false, message: "paypalOrderId and orderNumber are required" },
      { status: 400 }
    );
  }

  const cookie = request.headers.get("cookie") ?? "";

  try {
    const backendRes = await fetch(`${API_URL}/payments/paypal/capture-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({
        paypalOrderId: body.paypalOrderId,
        orderNumber: body.orderNumber,
      }),
      signal: AbortSignal.timeout(30_000), // Capture can take longer
    });

    const responseBody = await backendRes.json().catch(() => null);

    if (!backendRes.ok) {
      console.error(
        `[PayPal BFF] capture-order failed: status=${backendRes.status}`,
        responseBody
      );
      return NextResponse.json(
        {
          success: false,
          message: responseBody?.message ?? "PayPal capture failed",
        },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (err) {
    console.error("[PayPal BFF] capture-order error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to connect to payment service" },
      { status: 502 }
    );
  }
}
