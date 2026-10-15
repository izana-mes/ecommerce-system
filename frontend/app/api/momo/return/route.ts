import { NextRequest, NextResponse } from "next/server";
import {
  buildIpnRawSignature,
  hmacSha256Hex,
  resolveShopOrderNumber,
  signaturesMatch,
} from "@/lib/momo";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

/**
 * MoMo browser redirect after checkout.
 *
 * 1. Verifies the redirect signature (HMAC-SHA256) to confirm authenticity.
 * 2. Forwards the verified redirect params to the backend /confirm-redirect
 *    endpoint so the order can be marked paid server-side.
 *    This is essential for local development where MOMO_IPN_URL=http://localhost:8080
 *    is unreachable by MoMo's servers, meaning the IPN never fires.
 *    In production with a public IPN URL the IPN fires first; confirm-redirect is idempotent.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const resultCode = params.resultCode;
  const momoOrderId = params.orderId;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const shopOrderNumber = resolveShopOrderNumber(momoOrderId || "", params.extraData);

  if (!momoOrderId) {
    return NextResponse.json({ valid: false, message: "Missing orderId" }, { status: 400 });
  }

  if (!accessKey || !secretKey) {
    console.error("MOMO_RETURN: gateway keys not configured");
    return NextResponse.json({ valid: false, message: "Missing config" }, { status: 500 });
  }

  const rawSignature = buildIpnRawSignature({
    accessKey,
    amount: params.amount ?? "",
    extraData: params.extraData ?? "",
    message: params.message ?? "",
    orderId: momoOrderId,
    orderInfo: params.orderInfo ?? "",
    orderType: params.orderType ?? "",
    partnerCode: params.partnerCode ?? "",
    payType: params.payType ?? "",
    requestId: params.requestId ?? "",
    responseTime: params.responseTime ?? "",
    resultCode: params.resultCode ?? "",
    transId: params.transId ?? "",
  });
  const expected = hmacSha256Hex(secretKey, rawSignature);
  const validSignature = signaturesMatch(expected, params.signature ?? "");

  if (!validSignature) {
    console.error("MOMO_RETURN: invalid signature", {
      resultCode,
      message: params.message,
      transId: params.transId,
      orderId: momoOrderId,
    });
    return NextResponse.json(
      { valid: false, success: false, orderNumber: shopOrderNumber, message: "Invalid signature" },
      { status: 400 }
    );
  }

  const paid = resultCode === "0";

  console.info("MoMo return callback", {
    resultCode,
    message: params.message,
    transId: params.transId,
    orderId: momoOrderId,
    shopOrderNumber,
    amount: params.amount,
    paid,
  });

  // Forward to backend confirm-redirect so the order is marked paid server-side.
  // This is the fallback for when the IPN URL (localhost) is unreachable by MoMo's servers.
  // In production with a public IPN URL this is idempotent.
  if (paid) {
    try {
      const backendUrl = `${backendApiBaseUrl()}/payments/momo/confirm-redirect`;
      const confirmRes = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Forward all query params from MoMo redirect — resultCode, orderId, transId, signature, etc.
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(10_000),
      });
      const confirmData = (await confirmRes.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      console.info("MoMo confirm-redirect response", {
        httpStatus: confirmRes.status,
        success: confirmData?.success,
        message: confirmData?.message,
        shopOrderNumber,
      });
    } catch (err) {
      // Non-fatal: IPN may have already processed the payment, or will shortly.
      console.warn("MoMo confirm-redirect call failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }
  }

  return NextResponse.json({
    valid: true,
    success: paid,
    clearCart: paid,
    orderNumber: shopOrderNumber,
    message: paid ? "Payment successful" : params.message || "Payment failed or cancelled",
  });
}
