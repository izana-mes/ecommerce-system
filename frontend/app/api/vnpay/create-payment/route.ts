import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rateLimit";
import { buildVnpPaymentUrl, formatVnpDate, toGmt7 } from "@/lib/vnpay";

type OrderRow = {
  id: number;
  order_number: string;
  total_amount: number;
  currency: string;
  payment_status: string;
};

type PaymentRow = {
  metadata: string | null;
};

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const candidate = (forwarded?.split(",")[0] || realIp || "127.0.0.1").trim();

  // Keep checksum stable and avoid proxy-added formats that VNPay may reject.
  const normalized = candidate.replace(/^::ffff:/i, "");
  return normalized || "127.0.0.1";
}

export async function POST(request: NextRequest) {
  const limit = checkRateLimit(request, "payment-vnpay-create", 20, 5 * 60_000);
  if (!limit.ok) {
    return createRateLimitResponse("Too many payment requests. Please try again shortly.", limit.retryAfterSeconds);
  }

  const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
  const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
  const vnpUrl =
    process.env.VNPAY_URL?.trim() || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const returnUrl = process.env.VNPAY_RETURN_URL?.trim() || `${request.nextUrl.origin}/payment/vnpay-return`;

  if (!tmnCode || !hashSecret || !returnUrl) {
    return NextResponse.json(
      {
        error:
          "Missing VNPAY config. Required: VNPAY_TMN_CODE, VNPAY_HASH_SECRET",
      },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as { orderId?: number } | null;
  if (!body?.orderId) {
    return NextResponse.json({ error: "Missing required field: orderId" }, { status: 400 });
  }

  const usdToVndRate = Number(process.env.VNPAY_USD_TO_VND_RATE || 26000);
  const minVndAmount = Number(process.env.VNPAY_MIN_AMOUNT_VND || 5000);

  const conn = await getConnection();
  try {
    const [rows] = await conn.execute<OrderRow[]>(
      "SELECT id, order_number, total_amount, currency, payment_status FROM orders WHERE id = ? LIMIT 1",
      [body.orderId]
    );

    const order = rows[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Order already paid" }, { status: 409 });
    }

    const orderCurrency = String(order.currency || "VND").toUpperCase();
    let amountVnd = Number(order.total_amount);

    if (!Number.isFinite(amountVnd) || amountVnd <= 0) {
      return NextResponse.json({ error: "Invalid order amount" }, { status: 400 });
    }

    if (orderCurrency !== "VND") {
      if (orderCurrency === "USD") {
        amountVnd = amountVnd * usdToVndRate;
      } else {
        return NextResponse.json(
          { error: `Unsupported currency for VNPAY: ${orderCurrency}` },
          { status: 400 }
        );
      }
    }

    if (amountVnd < minVndAmount) {
      return NextResponse.json(
        {
          error: `Order amount is too small for VNPAY. Minimum is ${minVndAmount} VND.`,
        },
        { status: 400 }
      );
    }

    const nowGmt7 = toGmt7();
    const expire = new Date(nowGmt7.getTime() + 15 * 60 * 1000);

    const vnpParams: Record<string, string | number> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Amount: Math.round(amountVnd * 100),
      vnp_CreateDate: formatVnpDate(nowGmt7),
      vnp_CurrCode: "VND",
      vnp_IpAddr: getClientIp(request),
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toan don hang ${order.order_number}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: order.order_number,
      vnp_ExpireDate: formatVnpDate(expire),
    };

    const paymentUrl = buildVnpPaymentUrl(vnpUrl, vnpParams, hashSecret);
    const [paymentRows] = await conn.execute<PaymentRow[]>(
      "SELECT metadata FROM payments WHERE order_id = ? LIMIT 1",
      [order.id]
    );
    const existingMetadata = parseMetadata(paymentRows?.[0]?.metadata ?? null);

    await conn.execute(
      `UPDATE payments
       SET provider = 'vnpay', method = 'VNPAY', payment_reference = ?, status = 'pending', metadata = ?::jsonb
       WHERE order_id = ?`,
      [order.order_number, JSON.stringify({ ...existingMetadata, gateway: "vnpay", tmnCode }), order.id]
    );

    return NextResponse.json({ success: true, data: { paymentUrl } });
  } catch (error: unknown) {
    console.error(
      "Error creating VNPAY payment URL:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ error: "Failed to create VNPAY payment URL" }, { status: 500 });
  } finally {
    await conn.end();
  }
}
