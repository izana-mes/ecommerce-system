import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rateLimit";
import { buildVnpPaymentUrl, formatVnpDate, toGmt7 } from "@/lib/vnpay";

function isLocalhostHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isPrivateIpv4(hostname: string): boolean {
  return (
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)
  );
}

function isPublicHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized || isLocalhostHostname(normalized) || isPrivateIpv4(normalized)) {
    return false;
  }

  return !(
    normalized === "0.0.0.0" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  );
}

const isDev = process.env.NODE_ENV !== "production";

function buildReturnUrl(candidate: string | null | undefined): string | null {
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    // In development, allow localhost/private IPs so payment flow can be tested locally
    if (!isDev && !isPublicHostname(url.hostname)) return null;
    return new URL("/payment/vnpay-return", url.origin).toString();
  } catch {
    return null;
  }
}

function buildReturnUrlFromReferer(referer: string | null | undefined): string | null {
  if (!referer) return null;

  try {
    return buildReturnUrl(new URL(referer).origin);
  } catch {
    return null;
  }
}

function resolveVnpReturnUrl(request: NextRequest): { returnUrl: string | null; source: string } {
  // Trust the explicitly configured URL unconditionally (supports localhost in Docker).
  const rawConfigured = process.env.VNPAY_RETURN_URL?.trim();
  if (rawConfigured) {
    try {
      const url = new URL(rawConfigured);
      if (["http:", "https:"].includes(url.protocol)) {
        const returnUrl = new URL("/payment/vnpay-return", url.origin).toString();
        return { returnUrl, source: "env" };
      }
    } catch {
      // fall through to auto-detection
    }
  }

  const originHeader = buildReturnUrl(request.headers.get("origin"));
  if (originHeader) {
    return { returnUrl: originHeader, source: "origin-header" };
  }

  const refererOrigin = buildReturnUrlFromReferer(request.headers.get("referer"));
  if (refererOrigin) {
    return { returnUrl: refererOrigin, source: "referer" };
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    const forwarded = buildReturnUrl(`${forwardedProto}://${forwardedHost}`);
    if (forwarded) {
      return { returnUrl: forwarded, source: "forwarded-host" };
    }
  }

  const requestOrigin = buildReturnUrl(request.nextUrl.origin);
  if (requestOrigin) {
    return { returnUrl: requestOrigin, source: "request-url" };
  }

  return { returnUrl: null, source: "unresolved" };
}

export async function POST(request: NextRequest) {
  const limit = checkRateLimit(request, "payment-vnpay-create", 20, 5 * 60_000);
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

    // Read VNPAY config from env (set on Vercel dashboard, not exposed to browser)
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const hashSecret = process.env.VNPAY_HASH_SECRET;
    const vnpayUrl = process.env.VNPAY_URL ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const { returnUrl, source: returnUrlSource } = resolveVnpReturnUrl(request);
    const usdToVnd = Number(process.env.VNPAY_USD_TO_VND_RATE ?? "26000");
    const minVnd = Number(process.env.VNPAY_MIN_AMOUNT_VND ?? "5000");

    if (!tmnCode || !hashSecret || !returnUrl) {
      console.error("VNPAY env vars missing:", { tmnCode: !!tmnCode, hashSecret: !!hashSecret, returnUrl: !!returnUrl });
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

    console.info("VNPAY create-payment resolved return URL", {
      returnUrl,
      source: returnUrlSource,
      requestOrigin: request.nextUrl.origin,
      originHeader: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
    });

    // Convert USD → VND, multiply by 100 as required by VNPAY
    const amountVnd = Math.round(amountNumber * usdToVnd);
    if (amountVnd < minVnd) {
      return NextResponse.json(
        { error: `Minimum payment amount is ${minVnd / 100} VND` },
        { status: 400 }
      );
    }
    const vnpAmount = amountVnd * 100;

    const now = toGmt7();
    const createDate = formatVnpDate(now);
    // Expire in 15 minutes
    const expireDate = formatVnpDate(new Date(now.getTime() + 15 * 60 * 1000));

    // Get client IP for VNPAY
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(vnpAmount),
      vnp_CurrCode: "VND",
      vnp_TxnRef: orderNumber,
      vnp_OrderInfo: `Thanh toan don hang ${orderNumber}`,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ip,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    const paymentUrl = buildVnpPaymentUrl(vnpayUrl, params, hashSecret);

    return NextResponse.json({ data: { paymentUrl } }, { status: 200 });
  } catch (error: unknown) {
    console.error(
      "Error building VNPAY payment URL:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ error: "Payment service unavailable" }, { status: 502 });
  }
}
