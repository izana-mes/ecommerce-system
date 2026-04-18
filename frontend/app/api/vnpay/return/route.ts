import { NextRequest, NextResponse } from "next/server";
import { createVnpSecureHash } from "@/lib/vnpay";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function GET(request: NextRequest) {
  const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
  if (!hashSecret) {
    console.error("VNPAY_RETURN: VNPAY_HASH_SECRET not set");
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

  // 1. Verify signature locally (no DB needed)
  const rest = { ...params };
  delete rest.vnp_SecureHash;
  delete rest.vnp_SecureHashType;
  const computed = createVnpSecureHash(rest, hashSecret);
  const valid = computed.toLowerCase() === String(secureHash).toLowerCase();

  if (!valid) {
    return NextResponse.json({ valid: false, message: "Invalid signature" }, { status: 400 });
  }

  const paid = responseCode === "00" && transactionStatus === "00";

  // 2. Forward all VNPAY params to the backend IPN endpoint.
  //    The backend handles DB update, email notification, and idempotency.
  try {
    const ipnUrl = new URL(`${API_URL}/payments/vnpay/ipn`);
    for (const [key, value] of Object.entries(params)) {
      ipnUrl.searchParams.set(key, value);
    }
    const ipnRes = await fetch(ipnUrl.toString(), { method: "GET" });
    const ipnBody = await ipnRes.text().catch(() => "");
    console.log("VNPAY_RETURN: IPN forwarded →", ipnRes.status, ipnBody);
  } catch (ipnError) {
    // IPN call failure is non-fatal for the return page — log and continue.
    // The backend IPN listener will re-process if VNPAY retries.
    console.error(
      "VNPAY_RETURN: IPN forward failed:",
      ipnError instanceof Error ? ipnError.message : String(ipnError)
    );
  }

  return NextResponse.json({
    valid: true,
    success: paid,
    clearCart: paid,      // tells the UI page to clear the cart on success
    orderNumber: txnRef,
    message: paid ? "Payment successful" : "Payment failed",
  });
}
