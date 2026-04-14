import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

type DiscountType = "percentage" | "fixed";

function roundMoney(value: number): number {
  return Number((Math.round(value * 100) / 100).toFixed(2));
}

export async function POST(request: Request) {
  const conn = await getConnection();
  try {
    const body = await request.json();
    const rawCode = String(body?.code || "").trim().toUpperCase();
    const subtotal = Number(body?.subtotal ?? 0);

    if (!rawCode) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    }
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return NextResponse.json({ error: "Invalid subtotal value" }, { status: 400 });
    }

    const [rows] = await conn.execute<
      Array<{
        id: number;
        code: string;
        title: string;
        discount_type: DiscountType;
        discount_value: number;
        min_order_amount: number;
        max_discount_amount: number | null;
        usage_limit: number | null;
        usage_count: number;
        starts_at: string | null;
        expires_at: string | null;
        is_active: number;
      }>
    >(
      `SELECT id, code, title, discount_type, discount_value, min_order_amount, max_discount_amount,
              usage_limit, usage_count, starts_at, expires_at, is_active
       FROM coupons
       WHERE code = ?
       LIMIT 1`,
      [rawCode]
    );

    const coupon = rows?.[0];
    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }
    if (!coupon.is_active) {
      return NextResponse.json({ error: "Coupon is inactive" }, { status: 400 });
    }

    const now = Date.now();
    const startsAtMs = coupon.starts_at ? new Date(coupon.starts_at).getTime() : null;
    const expiresAtMs = coupon.expires_at ? new Date(coupon.expires_at).getTime() : null;
    if (startsAtMs && Number.isFinite(startsAtMs) && now < startsAtMs) {
      return NextResponse.json({ error: "Coupon is not active yet" }, { status: 400 });
    }
    if (expiresAtMs && Number.isFinite(expiresAtMs) && now > expiresAtMs) {
      return NextResponse.json({ error: "Coupon has expired" }, { status: 400 });
    }
    if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
      return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
    }
    if (subtotal < Number(coupon.min_order_amount || 0)) {
      return NextResponse.json(
        { error: `Minimum order for this coupon is $${Number(coupon.min_order_amount || 0).toFixed(2)}` },
        { status: 400 }
      );
    }

    const rawDiscount = coupon.discount_type === "percentage"
      ? subtotal * (Number(coupon.discount_value) / 100)
      : Number(coupon.discount_value);
    const cappedDiscount = coupon.max_discount_amount != null
      ? Math.min(rawDiscount, Number(coupon.max_discount_amount))
      : rawDiscount;
    const discountAmount = roundMoney(Math.min(subtotal, Math.max(0, cappedDiscount)));

    return NextResponse.json({
      success: true,
      data: {
        couponId: coupon.id,
        code: coupon.code,
        title: coupon.title,
        discountType: coupon.discount_type,
        discountValue: Number(coupon.discount_value),
        discountAmount,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to validate coupon", details: message }, { status: 500 });
  } finally {
    await conn.end();
  }
}
