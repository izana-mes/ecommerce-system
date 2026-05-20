import { NextResponse } from "next/server";

import {
  normalizeDiscountType,
  requireAdminUser,
  withCouponTables} from "@/lib/coupons";
import { getDbRuntimeInfo } from "@/lib/db";

type DiscountType = "percentage" | "fixed";

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function normalizeDbDatetime(raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  const { client } = getDbRuntimeInfo();
  if (client === "postgres") {
    return value;
  }

  // MySQL DATETIME typically does not accept `YYYY-MM-DDTHH:mm` (from <input type="datetime-local">).
  // Normalize to `YYYY-MM-DD HH:mm:ss` to avoid "Incorrect datetime value" errors.
  const trimmed = value.replace(/Z$/i, "");
  const replaced = trimmed.includes("T") ? trimmed.replace("T", " ") : trimmed;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(replaced)) {
    return `${replaced}:00`;
  }
  return replaced;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isDuplicateCouponCodeError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("duplicate entry") ||
    lower.includes("unique constraint") ||
    lower.includes("duplicate key value violates unique constraint")
  );
}

export async function GET(request: Request) {
  const admin = await requireAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(0, toPositiveInt(searchParams.get("page"), 1) - 1);
    const size = Math.min(100, toPositiveInt(searchParams.get("size"), 15));
    const q = String(searchParams.get("q") || "").trim().toLowerCase();

    const result = await withCouponTables(async (conn) => {
      const whereSql = q
        ? "WHERE LOWER(c.code) LIKE ? OR LOWER(c.title) LIKE ?"
        : "";
      const whereParams = q ? [`%${q}%`, `%${q}%`] : [];

      const [countRows] = await conn.execute<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM coupons c ${whereSql}`,
        whereParams
      );
      const totalElements = Number(countRows?.[0]?.total || 0);
      const totalPages = Math.max(1, Math.ceil(totalElements / size));

      const [rows] = await conn.execute<
        Array<{
          id: number;
          code: string;
          title: string;
          description: string | null;
          discount_type: DiscountType;
          discount_value: number;
          min_order_amount: number;
          max_discount_amount: number | null;
          usage_limit: number | null;
          usage_count: number;
          starts_at: string | null;
          expires_at: string | null;
          is_active: boolean | number;
          created_at: string;
          updated_at: string;
          assigned_count: number;
          acknowledged_count: number;
          used_assignment_count: number;
        }>
      >(
        `SELECT
           c.id,
           c.code,
           c.title,
           c.description,
           c.discount_type,
           c.discount_value,
           c.min_order_amount,
           c.max_discount_amount,
           c.usage_limit,
           c.usage_count,
           c.starts_at,
           c.expires_at,
           c.is_active,
           c.created_at,
           c.updated_at,
           COALESCE(COUNT(ca.id), 0) AS assigned_count,
           COALESCE(SUM(CASE WHEN ca.acknowledged_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS acknowledged_count,
           COALESCE(SUM(CASE WHEN ca.used_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS used_assignment_count
         FROM coupons c
         LEFT JOIN coupon_assignments ca ON ca.coupon_id = c.id
         ${whereSql}
         GROUP BY
           c.id,
           c.code,
           c.title,
           c.description,
           c.discount_type,
           c.discount_value,
           c.min_order_amount,
           c.max_discount_amount,
           c.usage_limit,
           c.usage_count,
           c.starts_at,
           c.expires_at,
           c.is_active,
           c.created_at,
           c.updated_at
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [...whereParams, size, page * size]
      );

      return {
        content: rows.map((row) => ({
          ...row,
          is_active: Boolean(row.is_active),
          assigned_count: Number(row.assigned_count || 0),
          acknowledged_count: Number(row.acknowledged_count || 0),
          used_assignment_count: Number(row.used_assignment_count || 0)})),
        totalElements,
        totalPages,
        number: page,
        size};
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    const status =
      message.includes("Missing PostgreSQL configuration") ||
      message.includes("Missing DB configuration") ||
      message.includes("Database connection failed")
        ? 503
        : 500;
    return NextResponse.json(
      {
        error: "Failed to fetch coupons",
        details: message,
        ...(status === 503
          ? {
              hint:
                "Coupon DB is not configured for this deployment. Set DATABASE_URL (Postgres) or MYSQL_URL / DB_HOST/DB_USER/DB_PASSWORD/DB_NAME in Vercel Environment Variables."}
          : {})},
      { status }
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const code = String(body?.code || "").trim().toUpperCase();
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim() || null;
    const discountType = normalizeDiscountType(body?.discount_type);
    const discountValue = Number(body?.discount_value ?? 0);
    const minOrderAmount = Number(body?.min_order_amount ?? 0);
    const maxDiscountAmount = body?.max_discount_amount == null ? null : Number(body?.max_discount_amount);
    const usageLimit = body?.usage_limit == null ? null : Number(body?.usage_limit);
    const startsAt = normalizeDbDatetime(body?.starts_at);
    const expiresAt = normalizeDbDatetime(body?.expires_at);
    const isActive = body?.is_active === false ? 0 : 1;

    if (!code || !title || !discountType) {
      return NextResponse.json({ error: "code, title and discount_type are required" }, { status: 400 });
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return NextResponse.json({ error: "discount_value must be > 0" }, { status: 400 });
    }
    if (discountType === "percentage" && discountValue > 100) {
      return NextResponse.json({ error: "percentage discount cannot exceed 100" }, { status: 400 });
    }

    await withCouponTables(async (conn) => {
      await conn.execute(
        `INSERT INTO coupons (
          code, title, description, discount_type, discount_value, min_order_amount, max_discount_amount,
          usage_limit, usage_count, starts_at, expires_at, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          code,
          title,
          description,
          discountType,
          discountValue,
          Number.isFinite(minOrderAmount) && minOrderAmount > 0 ? minOrderAmount : 0,
          maxDiscountAmount != null && Number.isFinite(maxDiscountAmount) && maxDiscountAmount > 0
            ? maxDiscountAmount
            : null,
          usageLimit != null && Number.isFinite(usageLimit) && usageLimit > 0 ? usageLimit : null,
          startsAt,
          expiresAt,
          isActive,
        ]
      );
    });

    return NextResponse.json({ success: true, message: "Coupon created successfully" }, { status: 201 });
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    console.error("admin-coupons POST failed", { message, error });

    if (isDuplicateCouponCodeError(message)) {
      return NextResponse.json(
        { error: "Coupon code already exists", details: message },
        { status: 409 }
      );
    }

    const status =
      message.includes("Missing PostgreSQL configuration") ||
      message.includes("Missing DB configuration") ||
      message.includes("Database connection failed")
        ? 503
        : 500;
    return NextResponse.json(
      {
        error: "Failed to create coupon",
        details: message,
        ...(status === 503
          ? {
              hint:
                "Coupon DB is not configured for this deployment. Set DATABASE_URL (Postgres) or MYSQL_URL / DB_HOST/DB_USER/DB_PASSWORD/DB_NAME in Vercel Environment Variables."}
          : {})},
      { status }
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const updates: string[] = [];
    const params: Array<string | number | null> = [];

    if (body.code != null) {
      updates.push("code = ?");
      params.push(String(body.code).trim().toUpperCase());
    }
    if (body.title != null) {
      updates.push("title = ?");
      params.push(String(body.title).trim());
    }
    if (body.description !== undefined) {
      const description = String(body.description || "").trim();
      updates.push("description = ?");
      params.push(description || null);
    }
    if (body.discount_type != null) {
      const discountType = normalizeDiscountType(body.discount_type);
      if (!discountType) {
        return NextResponse.json({ error: "Invalid discount_type" }, { status: 400 });
      }
      updates.push("discount_type = ?");
      params.push(discountType);
    }
    if (body.discount_value != null) {
      const value = Number(body.discount_value);
      if (!Number.isFinite(value) || value <= 0) {
        return NextResponse.json({ error: "discount_value must be > 0" }, { status: 400 });
      }
      updates.push("discount_value = ?");
      params.push(value);
    }
    if (body.min_order_amount != null) {
      updates.push("min_order_amount = ?");
      params.push(Math.max(0, Number(body.min_order_amount) || 0));
    }
    if (body.max_discount_amount !== undefined) {
      const value = body.max_discount_amount;
      updates.push("max_discount_amount = ?");
      params.push(value == null ? null : Math.max(0, Number(value) || 0));
    }
    if (body.usage_limit !== undefined) {
      const value = body.usage_limit;
      updates.push("usage_limit = ?");
      params.push(value == null ? null : Math.max(0, Number(value) || 0));
    }
    if (body.starts_at !== undefined) {
      updates.push("starts_at = ?");
      params.push(normalizeDbDatetime(body.starts_at));
    }
    if (body.expires_at !== undefined) {
      updates.push("expires_at = ?");
      params.push(normalizeDbDatetime(body.expires_at));
    }
    if (body.is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(body.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    await withCouponTables(async (conn) => {
      await conn.execute(`UPDATE coupons SET ${updates.join(", ")} WHERE id = ?`, [...params, id]);
    });

    return NextResponse.json({ success: true, message: "Coupon updated successfully" });
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    console.error("admin-coupons PATCH failed", { message, error });
    const status =
      message.includes("Missing PostgreSQL configuration") ||
      message.includes("Missing DB configuration") ||
      message.includes("Database connection failed")
        ? 503
        : 500;
    return NextResponse.json(
      {
        error: "Failed to update coupon",
        details: message,
        ...(status === 503
          ? {
              hint:
                "Coupon DB is not configured for this deployment. Set DATABASE_URL (Postgres) or MYSQL_URL / DB_HOST/DB_USER/DB_PASSWORD/DB_NAME in Vercel Environment Variables."}
          : {})},
      { status }
    );
  }
}
