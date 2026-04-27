import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { finalizeCouponRedemption, validateCouponCode } from "@/lib/coupons";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: NextRequest): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getCookieHeader(request: NextRequest): string | null {
  return request.headers.get("cookie");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = items.reduce((sum, item) => {
      const price = Number(item?.productPrice ?? 0);
      const quantity = Number(item?.quantity ?? 0);
      if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
        return sum;
      }
      return sum + price * quantity;
    }, 0);

    const couponCode = String(body.couponCode || "").trim().toUpperCase();
    let validatedCoupon = null;
    if (couponCode) {
      try {
        validatedCoupon = await validateCouponCode(request, couponCode, subtotal);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Coupon is not valid";
        const status =
          message === "Coupon not found" ? 404
          : message === "Sign in to use this coupon" ? 401
          : 400;
        return NextResponse.json({ error: message }, { status });
      }
    }

    const sanitizedBody = {
      ...body,
      couponCode: validatedCoupon?.code ?? null,
      couponAssignmentId: validatedCoupon?.assignmentId ?? null,
      couponDiscount: validatedCoupon?.discountAmount ?? 0,
    };

    const authHeader = getAuthHeader(request);
    const cookieHeader = getCookieHeader(request);

    const backendResponse = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(sanitizedBody),
    });

    const rawText = await backendResponse.text();
    let data: unknown = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { message: rawText };
      }
    }

    if (!backendResponse.ok) {
      const payload =
        data && typeof data === "object"
          ? data
          : {
              error: `Backend /orders failed with status ${backendResponse.status}`,
              details: rawText || backendResponse.statusText || "Unknown backend error",
            };
      return NextResponse.json(payload, { status: backendResponse.status });
    }

    const backendPayload =
      data && typeof data === "object"
        ? data as { data?: { orderId?: number } | null }
        : null;

    if (validatedCoupon) {
      const orderId = Number(backendPayload?.data?.orderId ?? 0);
      if (orderId > 0) {
        try {
          await finalizeCouponRedemption(request, orderId, validatedCoupon.code, subtotal);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to finalize coupon redemption";
          console.error(`Order ${orderId} created but coupon redemption sync failed:`, message);
        }
      }
    }

    return NextResponse.json(data ?? { success: true }, { status: backendResponse.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    console.error("Error proxying order creation:", message);
    return NextResponse.json({ error: "Order service unavailable", details: message }, { status: 502 });
  }
}
