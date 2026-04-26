import { NextResponse } from "next/server";

import { requireAdminUser, withCouponTables } from "@/lib/coupons";

type CouponRow = {
  id: number;
  code: string;
  title: string;
  is_active: boolean | number;
};

type AssignmentRow = {
  id: number;
};

export async function POST(request: Request) {
  const admin = await requireAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const couponId = Number(body?.couponId);
    const recipients = Array.isArray(body?.recipients) ? body.recipients : [];
    const notificationTitle = String(body?.notificationTitle || "").trim();
    const notificationMessage = String(body?.notificationMessage || "").trim();

    if (!Number.isInteger(couponId) || couponId <= 0) {
      return NextResponse.json({ error: "Valid couponId is required" }, { status: 400 });
    }
    if (recipients.length === 0) {
      return NextResponse.json({ error: "Select at least one customer" }, { status: 400 });
    }

    const result = await withCouponTables(async (conn) => {
      const [couponRows] = await conn.execute<CouponRow[]>(
        `SELECT id, code, title, is_active FROM coupons WHERE id = ? LIMIT 1`,
        [couponId]
      );
      const coupon = couponRows?.[0];
      if (!coupon) {
        throw new Error("Coupon not found");
      }
      if (!coupon.is_active) {
        throw new Error("Coupon must be active before issuing");
      }

      let issued = 0;
      let skipped = 0;

      for (const entry of recipients as Array<Record<string, unknown>>) {
        const userId = String(entry?.userId || "").trim();
        const userEmail = String(entry?.email || "").trim().toLowerCase();
        if (!userId || !userEmail) {
          skipped += 1;
          continue;
        }

        const [existingRows] = await conn.execute<AssignmentRow[]>(
          `SELECT id
           FROM coupon_assignments
           WHERE coupon_id = ?
             AND user_id = ?
             AND used_at IS NULL
           LIMIT 1`,
          [couponId, userId]
        );

        if (existingRows.length > 0) {
          skipped += 1;
          continue;
        }

        await conn.execute(
          `INSERT INTO coupon_assignments (
             coupon_id,
             user_id,
             user_email,
             notification_title,
             notification_message,
             issued_by_email
           ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            couponId,
            userId,
            userEmail,
            notificationTitle || `Coupon ${coupon.code} is waiting for you`,
            notificationMessage || `Confirm receipt to unlock ${coupon.title}.`,
            admin.email,
          ]
        );
        issued += 1;
      }

      return { issued, skipped };
    });

    return NextResponse.json({
      success: true,
      message: `Issued to ${result.issued} customer(s)`,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Coupon not found" ? 404 : 400;
    return NextResponse.json({ error: "Failed to issue coupon", details: message }, { status });
  }
}
