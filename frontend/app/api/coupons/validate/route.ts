import { NextResponse } from "next/server";

import { validateCouponCode } from "@/lib/coupons";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const coupon = await validateCouponCode(
      request,
      String(body?.code || ""),
      Number(body?.subtotal ?? 0)
    );

    return NextResponse.json({
      success: true,
      data: coupon,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message === "Coupon not found" ? 404
      : message === "Sign in to use this coupon" ? 401
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
