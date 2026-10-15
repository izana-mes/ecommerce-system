import { NextRequest, NextResponse } from "next/server";
import {
  buildIpnRawSignature,
  hmacSha256Hex,
  resolveShopOrderNumber,
  signaturesMatch,
} from "@/lib/momo";

/**
 * MoMo browser redirect after checkout. Verifies the result signature for display.
 * Order payment status is updated only by the server-to-server IPN.
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
  });

  return NextResponse.json({
    valid: true,
    success: paid,
    clearCart: paid,
    orderNumber: shopOrderNumber,
    message: paid ? "Payment successful" : params.message || "Payment failed or cancelled",
  });
}
