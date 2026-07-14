import { NextRequest, NextResponse } from "next/server";
import { createVnpSecureHash } from "@/lib/vnpay";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function GET(request: NextRequest) {
  const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
  if (!hashSecret) {
    console.error("VNPAY_RETURN: VNPAY_HASH_SECRET not configured on Vercel");
    return NextResponse.json({ valid: false, message: "Missing config" }, { status: 500 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const secureHash = params.vnp_SecureHash;
  const txnRef = params.vnp_TxnRef;
  const responseCode = params.vnp_ResponseCode;
  const transactionStatus = params.vnp_TransactionStatus;

  if (!secureHash || !txnRef) {
    return NextResponse.json({ valid: false, message: "Missing required params" }, { status: 400 });
  }

  // 1. Verify VNPAY hash locally (no DB, no backend needed)
  const rest = { ...params };
  delete rest.vnp_SecureHash;
  delete rest.vnp_SecureHashType;
  const computed = createVnpSecureHash(rest, hashSecret);
  const valid = computed.toLowerCase() === String(secureHash).toLowerCase();

  if (!valid) {
    return NextResponse.json({ valid: false, message: "Invalid signature" }, { status: 400 });
  }

  const paid = responseCode === "00" && transactionStatus === "00";

  // 2. Forward ALL params to backend POST /payments/vnpay/ipn (DB + paid-order email).
  let backendConfirmed = false;
  let backendMessage = "";
  try {
    const backendRes = await fetch(`${API_URL}/payments/vnpay/ipn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15_000),
    });
    const backendBody = (await backendRes.json().catch(() => null)) as
      | { RspCode?: string; rspCode?: string; Message?: string; message?: string }
      | null;
    const rspCode = String(backendBody?.RspCode ?? backendBody?.rspCode ?? "").trim();
    backendMessage = String(backendBody?.Message ?? backendBody?.message ?? "").trim();
    backendConfirmed = rspCode === "00" || rspCode === "02";
    if (!backendRes.ok || !backendConfirmed) {
      console.error(
        `VNPAY_RETURN: backend IPN not confirmed (http=${backendRes.status}, RspCode=${rspCode}): ${backendMessage}`
      );
    }
  } catch (err) {
    console.error("VNPAY_RETURN: backend IPN call failed:", err instanceof Error ? err.message : err);
  }

  const success = paid && backendConfirmed;
  return NextResponse.json({
    valid: true,
    success,
    clearCart: success,
    orderNumber: txnRef,
    message: success
      ? "Payment successful"
      : paid
        ? backendMessage || "Payment received but order confirmation is still processing. Please refresh your orders shortly."
        : "Payment failed",
  });
}
