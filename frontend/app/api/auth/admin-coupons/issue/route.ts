import { NextResponse } from "next/server";

import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { requireAdminUser, withCouponTables } from "@/lib/coupons";

type CouponRow = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  expires_at: string | null;
  is_active: boolean | number;
};

type AssignmentRow = {
  id: number;
};

type IssuedAssignment = {
  assignmentId: number;
  userId: string;
  userEmail: string;
  firstName: string | null;
  lastName: string | null;
  notificationTitle: string;
  notificationMessage: string;
};

const API_URL = backendApiBaseUrl();

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
        `SELECT id, code, title, description, expires_at, is_active FROM coupons WHERE id = ? LIMIT 1`,
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
      const assignments: IssuedAssignment[] = [];

      for (const entry of recipients as Array<Record<string, unknown>>) {
        const userId = String(entry?.userId || "").trim();
        const userEmail = String(entry?.email || "").trim().toLowerCase();
        const firstName = String(entry?.firstName || "").trim() || null;
        const lastName = String(entry?.lastName || "").trim() || null;
        if (!userId || !userEmail) {
          skipped += 1;
          continue;
        }

        const effectiveTitle = notificationTitle || `Coupon ${coupon.code} is waiting for you`;
        const effectiveMessage = notificationMessage || `Confirm receipt to unlock ${coupon.title}.`;

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
            effectiveTitle,
            effectiveMessage,
            admin.email,
          ]
        );

        const [assignmentRows] = await conn.execute<AssignmentRow[]>(
          `SELECT id
           FROM coupon_assignments
           WHERE coupon_id = ?
             AND user_id = ?
             AND user_email = ?
             AND used_at IS NULL
           ORDER BY issued_at DESC, id DESC
           LIMIT 1`,
          [couponId, userId, userEmail]
        );
        const assignment = assignmentRows?.[0];
        if (assignment) {
          assignments.push({
            assignmentId: Number(assignment.id),
            userId,
            userEmail,
            firstName,
            lastName,
            notificationTitle: effectiveTitle,
            notificationMessage: effectiveMessage,
          });
        }
        issued += 1;
      }

      return {
        issued,
        skipped,
        coupon: {
          code: coupon.code,
          title: coupon.title,
          description: coupon.description,
          expiresAt: coupon.expires_at,
        },
        assignments,
      };
    });

    const internalToken = process.env.INTERNAL_NOTIFY_TOKEN?.trim();
    const appOrigin = new URL(request.url).origin;
    const mailResults = await Promise.allSettled(
      result.assignments.map(async (assignment) => {
        const redeemUrl = new URL("/coupons/redeem", appOrigin);
        redeemUrl.searchParams.set("assignmentId", String(assignment.assignmentId));
        redeemUrl.searchParams.set("coupon", result.coupon.code);
        redeemUrl.searchParams.set("title", result.coupon.title);

        const response = await fetch(`${API_URL}/internal/notifications/coupon-issued`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(internalToken ? { "X-Internal-Token": internalToken } : {}),
          },
          body: JSON.stringify({
            to: assignment.userEmail,
            customerFirstName: assignment.firstName,
            customerLastName: assignment.lastName,
            couponCode: result.coupon.code,
            couponTitle: result.coupon.title,
            notificationTitle: assignment.notificationTitle,
            notificationMessage: assignment.notificationMessage,
            redeemUrl: redeemUrl.toString(),
            expiresAt: result.coupon.expiresAt,
          }),
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
          throw new Error(payload?.message || payload?.error || `Email request failed with ${response.status}`);
        }

        return assignment.userEmail;
      })
    );

    const emailFailures = mailResults.flatMap((mailResult, index) => {
      if (mailResult.status === "fulfilled") {
        return [];
      }

      const assignment = result.assignments[index];
      return [{
        email: assignment?.userEmail || "unknown",
        error: mailResult.reason instanceof Error ? mailResult.reason.message : String(mailResult.reason),
      }];
    });

    return NextResponse.json({
      success: true,
      message:
        emailFailures.length > 0
          ? `Issued to ${result.issued} customer(s), but ${emailFailures.length} email(s) failed`
          : `Issued to ${result.issued} customer(s)`,
      ...result,
      emailFailures,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Coupon not found" ? 404 : 400;
    return NextResponse.json({ error: "Failed to issue coupon", details: message }, { status });
  }
}
