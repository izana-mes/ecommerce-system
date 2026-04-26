import { NextResponse } from "next/server";

import { requireAuthUser, withCouponTables } from "@/lib/coupons";

type NotificationRow = {
  id: number;
  coupon_id: number;
  user_email: string;
  notification_title: string | null;
  notification_message: string | null;
  issued_at: string;
  acknowledged_at: string | null;
  used_at: string | null;
  used_order_id: number | null;
  coupon_code: string;
  coupon_title: string;
  coupon_description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean | number;
};

export async function GET(request: Request) {
  const user = await requireAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const payload = await withCouponTables(async (conn) => {
      const [rows] = await conn.execute<NotificationRow[]>(
        `SELECT
           ca.id,
           ca.coupon_id,
           ca.user_email,
           ca.notification_title,
           ca.notification_message,
           ca.issued_at,
           ca.acknowledged_at,
           ca.used_at,
           ca.used_order_id,
           c.code AS coupon_code,
           c.title AS coupon_title,
           c.description AS coupon_description,
           c.discount_type,
           c.discount_value,
           c.min_order_amount,
           c.max_discount_amount,
           c.starts_at,
           c.expires_at,
           c.is_active
         FROM coupon_assignments ca
         INNER JOIN coupons c ON c.id = ca.coupon_id
         WHERE ca.user_id = ?
         ORDER BY
           CASE WHEN ca.acknowledged_at IS NULL THEN 0 ELSE 1 END,
           ca.issued_at DESC`,
        [user.id]
      );

      return rows.map((row) => ({
        id: row.id,
        couponId: row.coupon_id,
        userEmail: row.user_email,
        notificationTitle: row.notification_title,
        notificationMessage: row.notification_message,
        issuedAt: row.issued_at,
        acknowledgedAt: row.acknowledged_at,
        usedAt: row.used_at,
        usedOrderId: row.used_order_id,
        coupon: {
          code: row.coupon_code,
          title: row.coupon_title,
          description: row.coupon_description,
          discountType: row.discount_type,
          discountValue: Number(row.discount_value),
          minOrderAmount: Number(row.min_order_amount || 0),
          maxDiscountAmount: row.max_discount_amount == null ? null : Number(row.max_discount_amount),
          startsAt: row.starts_at,
          expiresAt: row.expires_at,
          isActive: Boolean(row.is_active),
        },
        status: row.used_at ? "used" : row.acknowledged_at ? "ready" : "pending",
      }));
    });

    return NextResponse.json({ content: payload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load coupon notifications", details: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const assignmentId = Number(body?.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return NextResponse.json({ error: "Valid assignmentId is required" }, { status: 400 });
    }

    const result = await withCouponTables(async (conn) => {
      const [rows] = await conn.execute<Array<{ acknowledged_at: string | null; used_at: string | null }>>(
        `SELECT acknowledged_at, used_at
         FROM coupon_assignments
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [assignmentId, user.id]
      );
      const row = rows?.[0];
      if (!row) {
        throw new Error("Coupon notification not found");
      }
      if (row.used_at) {
        throw new Error("Coupon has already been used");
      }
      if (!row.acknowledged_at) {
        await conn.execute(
          `UPDATE coupon_assignments
           SET acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [assignmentId]
        );
      }
      return { alreadyAcknowledged: Boolean(row.acknowledged_at) };
    });

    return NextResponse.json({
      success: true,
      message: result.alreadyAcknowledged ? "Coupon already confirmed" : "Coupon confirmed successfully",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Coupon notification not found" ? 404 : 400;
    return NextResponse.json({ error: "Failed to confirm coupon", details: message }, { status });
  }
}
