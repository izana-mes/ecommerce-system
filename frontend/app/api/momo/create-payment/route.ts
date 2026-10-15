import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rateLimit";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import {
  MOMO_MAX_AMOUNT_VND,
  MOMO_MIN_AMOUNT_VND,
  buildCreateRawSignature,
  encodeOrderExtraData,
  hmacSha256Hex,
  newMomoOrderId,
  newMomoRequestId,
  resolveMomoCreateUrl,
  resolveMomoEndpoint,
  resolveMomoRequestType,
  resolveUsdToVndRate,
  toVndAmount,
} from "@/lib/momo";

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

    // 1. Attempt to create payment securely via Spring backend
    try {
      const backendUrl = `${backendApiBaseUrl()}/payments/momo/create-payment?orderNumber=${encodeURIComponent(orderNumber)}`;
      const backendRes = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : {}),
          ...(request.headers.get("authorization") ? { authorization: request.headers.get("authorization")! } : {}),
        },
        body: JSON.stringify({ orderNumber, amount: amountNumber }),
        signal: AbortSignal.timeout(15_000),
      });

      if (backendRes.ok) {
        const backendData = (await backendRes.json().catch(() => null)) as {
          payUrl?: string;
          data?: { paymentUrl?: string };
          success?: boolean;
          message?: string;
        } | null;
        const paymentUrl = backendData?.payUrl || backendData?.data?.paymentUrl;
        if (paymentUrl) {
          return NextResponse.json({ data: { paymentUrl } }, { status: 200 });
        }
      }
    } catch {
      // Backend unreachable or standalone test environment, proceed to direct gateway caller
    }

    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const redirectUrl = process.env.MOMO_REDIRECT_URL;
    const ipnUrl = process.env.MOMO_IPN_URL;
    const createUrl = resolveMomoCreateUrl(resolveMomoEndpoint());

    let usdToVnd: number;
    try {
      usdToVnd = resolveUsdToVndRate(process.env.MOMO_USD_TO_VND_RATE);
    } catch {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

    if (!partnerCode || !accessKey || !secretKey || !redirectUrl || !ipnUrl) {
      console.error("MOMO env vars missing");
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

    const amountVnd = toVndAmount(amountNumber, usdToVnd);
    if (amountVnd < MOMO_MIN_AMOUNT_VND || amountVnd > MOMO_MAX_AMOUNT_VND) {
      return NextResponse.json(
        { error: `MoMo amount must be between ${MOMO_MIN_AMOUNT_VND} and ${MOMO_MAX_AMOUNT_VND} VND` },
        { status: 400 }
      );
    }

    const requestType = resolveMomoRequestType();
    const orderInfo = `Thanh toan don hang ${orderNumber}`;
    const requestId = newMomoRequestId();
    const momoOrderId = newMomoOrderId(orderNumber);
    const extraData = encodeOrderExtraData(orderNumber);
    const partnerName = process.env.MOMO_PARTNER_NAME?.trim() || "Test";
    const storeId = process.env.MOMO_STORE_ID?.trim() || "MoMoTestStore";

    const rawSignature = buildCreateRawSignature({
      accessKey,
      amount: amountVnd,
      extraData,
      ipnUrl,
      orderId: momoOrderId,
      orderInfo,
      partnerCode,
      redirectUrl,
      requestId,
      requestType,
    });
    const signature = hmacSha256Hex(secretKey, rawSignature);

    const requestBody = {
      partnerCode,
      partnerName,
      storeId,
      requestId,
      amount: amountVnd,
      orderId: momoOrderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      requestType,
      extraData,
      lang: "vi",
      signature,
    };

    const response = await fetch(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30_000),
    });

    const data = (await response.json().catch(() => null)) as {
      resultCode?: number;
      message?: string;
      payUrl?: string;
    } | null;

    console.info("MoMo create-payment response", {
      httpStatus: response.status,
      resultCode: data?.resultCode,
      message: data?.message,
      orderId: momoOrderId,
      shopOrderNumber: orderNumber,
      amountVnd,
      requestType,
    });

    if (!data || data.resultCode !== 0 || !data.payUrl) {
      console.error("MoMo payment creation failed:", {
        resultCode: data?.resultCode,
        message: data?.message,
      });
      return NextResponse.json({ error: data?.message || "Cannot create MoMo payment URL" }, { status: 500 });
    }

    return NextResponse.json({ data: { paymentUrl: data.payUrl } }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error building MOMO payment request:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Payment service unavailable" }, { status: 502 });
  }
}
