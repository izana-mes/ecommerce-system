import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rateLimit";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const limit = checkRateLimit(request, "payment-momo-create", 20, 5 * 60_000);
  if (!limit.ok) {
    return createRateLimitResponse("Too many payment requests. Please try again shortly.", limit.retryAfterSeconds);
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { orderNumber, amount } = body as Record<string, unknown>;

    if (!orderNumber || typeof orderNumber !== "string") {
      return NextResponse.json({ error: "Missing orderNumber" }, { status: 400 });
    }
    const amountNumber = Number(amount);
    if (!amount || isNaN(amountNumber) || amountNumber <= 0) {
      return NextResponse.json({ error: "Missing or invalid amount (USD)" }, { status: 400 });
    }

    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const returnUrl = process.env.MOMO_REDIRECT_URL;
    const ipnUrl = process.env.MOMO_IPN_URL;
    const usdToVnd = Number(process.env.MOMO_USD_TO_VND_RATE ?? "26000");

    if (!partnerCode || !accessKey || !secretKey || !returnUrl || !ipnUrl) {
      console.error("MOMO env vars missing");
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

    const amountVnd = Math.round(amountNumber * usdToVnd);
    
    // MoMo API request parameters
    const requestType = "payWithMethod";
    const orderInfo = `Thanh toan don hang ${orderNumber}`;
    const requestId = String(Date.now()) + "id";
    const extraData = "";

    // Signature formula for create payment: accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
    const rawSignature = `accessKey=${accessKey}&amount=${amountVnd}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderNumber}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=${requestType}`;
    
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");

    const requestBody = {
      partnerCode,
      partnerName: "Test Store",
      storeId: "MomoTestStore",
      requestId,
      amount: amountVnd,
      orderId: orderNumber,
      orderInfo,
      redirectUrl: returnUrl,
      ipnUrl,
      lang: "vi",
      extraData,
      requestType,
      signature};

    const momoEndpoint = "https://test-payment.momo.vn/v2/gateway/api/create";
    const response = await fetch(momoEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)});

    const data = await response.json();
    if (data.resultCode !== 0) {
      console.error("MoMo payment creation failed:", data);
      return NextResponse.json({ error: data.message || "Cannot create MoMo payment URL" }, { status: 500 });
    }

    return NextResponse.json({ data: { paymentUrl: data.payUrl } }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error building MOMO payment request:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Payment service unavailable" }, { status: 502 });
  }
}
