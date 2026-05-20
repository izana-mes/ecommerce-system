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

  // 2. Forward ALL params to backend POST /api/payments/vnpay/ipn
  //    Backend handles: DB update + direct SMTP email (no RabbitMQ needed)
  //    This call is best-effort — frontend NEVER returns 500 just because backend fails.
  try {
    const backendRes = await fetch(`${API_URL}/payments/vnpay/ipn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),   // includes vnp_SecureHash so backend can re-verify
      signal: AbortSignal.timeout(15_000)});
    if (!backendRes.ok) {
      const errText = await backendRes.text().catch(() => "");
      console.error(`VNPAY_RETURN: backend IPN returned ${backendRes.status}: ${errText}`);
    }
  } catch (err) {
    console.error("VNPAY_RETURN: backend IPN call failed:", err instanceof Error ? err.message : err);
  }

  // 3. Always return payment status from VNPAY params (never 500 on backend failure)
  return NextResponse.json({
    valid: true,
    success: paid,
    clearCart: paid,
    orderNumber: txnRef,
    message: paid ? "Payment successful" : "Payment failed"});
}
