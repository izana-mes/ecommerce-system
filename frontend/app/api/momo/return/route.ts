import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

/**
 * MoMo redirect callback. Forwards gateway params to the Spring IPN handler so
 * the order is marked paid and the confirmation email is sent when MoMo cannot
 * reach the backend IPN URL directly (e.g. misconfigured MOMO_IPN_URL).
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const resultCode = params.resultCode;
  const orderId = params.orderId;

  if (!orderId) {
    return NextResponse.json({ valid: false, message: "Missing orderId" }, { status: 400 });
  }

  const paid = resultCode === "0";

  let backendConfirmed = false;
  try {
    const backendRes = await fetch(`${API_URL}/payments/momo/ipn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15_000),
    });
    backendConfirmed = backendRes.ok || backendRes.status === 204;
    if (!backendConfirmed) {
      const errText = await backendRes.text().catch(() => "");
      console.error(`MOMO_RETURN: backend IPN returned ${backendRes.status}: ${errText}`);
    }
  } catch (err) {
    console.error("MOMO_RETURN: backend IPN call failed:", err instanceof Error ? err.message : err);
  }

  const success = paid && backendConfirmed;
  return NextResponse.json({
    valid: true,
    success,
    clearCart: success,
    orderNumber: orderId,
    message: success
      ? "Payment successful"
      : paid
        ? "Payment received but order confirmation is still processing. Please refresh your orders shortly."
        : params.message || "Payment failed or cancelled",
  });
}
