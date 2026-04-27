import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { DbConnection, getConnection, getDbRuntimeInfo } from "@/lib/db";

export type DiscountType = "percentage" | "fixed";
type CouponRecord = {
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
};

type CouponAssignmentRecord = {
  id: number;
  acknowledged_at: string | null;
  used_at: string | null;
};

export type ValidatedCoupon = {
  couponId: number;
  assignmentId: number | null;
  code: string;
  title: string;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
};

export type FinalizedCouponRedemption = {
  couponId: number;
  assignmentId: number | null;
  code: string;
  discountAmount: number;
};

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "admin" | "employee";
  firstName?: string | null;
  lastName?: string | null;
};

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getCookieHeader(request: Request): string | null {
  return request.headers.get("cookie");
}

export function normalizeDiscountType(value: unknown): DiscountType | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "percentage" || normalized === "fixed") {
    return normalized;
  }
  return null;
}

export function roundMoney(value: number): number {
  return Number((Math.round(value * 100) / 100).toFixed(2));
}

function parseTimestampMs(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function requireAuthUser(request: Request): Promise<AuthUser | null> {
  const authHeader = getAuthHeader(request);
  const cookieHeader = getCookieHeader(request);

  if (!authHeader && !cookieHeader) {
    return null;
  }

  const response = await fetch(`${API_URL}/v1/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        data?: {
          id?: string;
          email?: string;
          role?: "user" | "admin" | "employee";
          firstName?: string | null;
          lastName?: string | null;
        } | null;
      }
    | null;

  const data = payload?.data;
  if (!data?.id || !data?.email || !data?.role) {
    return null;
  }

  return {
    id: String(data.id),
    email: String(data.email).trim().toLowerCase(),
    role: data.role,
    firstName: data.firstName ?? null,
    lastName: data.lastName ?? null,
  };
}

export async function requireAdminUser(request: Request): Promise<AuthUser | null> {
  const user = await requireAuthUser(request);
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export async function withCouponTables<T>(
  runner: (conn: DbConnection) => Promise<T>
): Promise<T> {
  const conn = await getConnection();
  try {
    await ensureCouponTables(conn);
    return await runner(conn);
  } finally {
    await conn.end();
  }
}

async function ensureCouponTables(conn: DbConnection): Promise<void> {
  const { client } = getDbRuntimeInfo();

  if (client === "postgres") {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS coupons (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(120) NOT NULL,
        description TEXT NULL,
        discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
        discount_value NUMERIC(10, 2) NOT NULL,
        min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        max_discount_amount NUMERIC(10, 2) NULL,
        usage_limit INT NULL,
        usage_count INT NOT NULL DEFAULT 0,
        starts_at TIMESTAMP NULL,
        expires_at TIMESTAMP NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS coupon_assignments (
        id BIGSERIAL PRIMARY KEY,
        coupon_id BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        notification_title VARCHAR(160) NULL,
        notification_message TEXT NULL,
        issued_by_email VARCHAR(255) NULL,
        issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at TIMESTAMP NULL,
        used_at TIMESTAMP NULL,
        used_order_id BIGINT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await ensureIndex(conn, "coupons", "idx_coupons_code", `CREATE INDEX idx_coupons_code ON coupons(code)`);
    await ensureIndex(
      conn,
      "coupons",
      "idx_coupons_active_dates",
      `CREATE INDEX idx_coupons_active_dates ON coupons(is_active, starts_at, expires_at)`
    );
    await ensureIndex(
      conn,
      "coupon_assignments",
      "idx_coupon_assignments_user_id",
      `CREATE INDEX idx_coupon_assignments_user_id ON coupon_assignments(user_id)`
    );
    await ensureIndex(
      conn,
      "coupon_assignments",
      "idx_coupon_assignments_user_email",
      `CREATE INDEX idx_coupon_assignments_user_email ON coupon_assignments(user_email)`
    );
    await ensureIndex(
      conn,
      "coupon_assignments",
      "idx_coupon_assignments_coupon_id",
      `CREATE INDEX idx_coupon_assignments_coupon_id ON coupon_assignments(coupon_id)`
    );
    await ensureIndex(
      conn,
      "coupon_assignments",
      "idx_coupon_assignments_status",
      `CREATE INDEX idx_coupon_assignments_status ON coupon_assignments(acknowledged_at, used_at, issued_at)`
    );
    return;
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS coupons (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      title VARCHAR(120) NOT NULL,
      description TEXT NULL,
      discount_type VARCHAR(20) NOT NULL,
      discount_value DECIMAL(10, 2) NOT NULL,
      min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      max_discount_amount DECIMAL(10, 2) NULL,
      usage_limit INT NULL,
      usage_count INT NOT NULL DEFAULT 0,
      starts_at DATETIME NULL,
      expires_at DATETIME NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS coupon_assignments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      coupon_id BIGINT UNSIGNED NOT NULL,
      user_id CHAR(36) NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      notification_title VARCHAR(160) NULL,
      notification_message TEXT NULL,
      issued_by_email VARCHAR(255) NULL,
      issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      acknowledged_at DATETIME NULL,
      used_at DATETIME NULL,
      used_order_id BIGINT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_coupon_assignments_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
    )
  `);
  await ensureIndex(conn, "coupons", "idx_coupons_code", `CREATE INDEX idx_coupons_code ON coupons(code)`);
  await ensureIndex(
    conn,
    "coupons",
    "idx_coupons_active_dates",
    `CREATE INDEX idx_coupons_active_dates ON coupons(is_active, starts_at, expires_at)`
  );
  await ensureIndex(
    conn,
    "coupon_assignments",
    "idx_coupon_assignments_user_id",
    `CREATE INDEX idx_coupon_assignments_user_id ON coupon_assignments(user_id)`
  );
  await ensureIndex(
    conn,
    "coupon_assignments",
    "idx_coupon_assignments_user_email",
    `CREATE INDEX idx_coupon_assignments_user_email ON coupon_assignments(user_email)`
  );
  await ensureIndex(
    conn,
    "coupon_assignments",
    "idx_coupon_assignments_coupon_id",
    `CREATE INDEX idx_coupon_assignments_coupon_id ON coupon_assignments(coupon_id)`
  );
  await ensureIndex(
    conn,
    "coupon_assignments",
    "idx_coupon_assignments_status",
    `CREATE INDEX idx_coupon_assignments_status ON coupon_assignments(acknowledged_at, used_at, issued_at)`
  );
}

async function ensureIndex(
  conn: DbConnection,
  tableName: string,
  indexName: string,
  createSql: string
): Promise<void> {
  const { client } = getDbRuntimeInfo();

  if (client === "postgres") {
    const [rows] = await conn.execute<Array<{ indexname: string }>>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = ANY (current_schemas(false))
         AND tablename = ?
         AND indexname = ?
       LIMIT 1`,
      [tableName, indexName]
    );
    if (rows.length === 0) {
      await conn.execute(createSql);
    }
    return;
  }

  const [rows] = await conn.execute<Array<{ index_name: string }>>(
    `SELECT index_name
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  if (rows.length === 0) {
    await conn.execute(createSql);
  }
}

export async function validateCouponCode(
  request: Request,
  code: string,
  subtotal: number
): Promise<ValidatedCoupon> {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("Coupon code is required");
  }
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new Error("Invalid subtotal value");
  }

  const user = await requireAuthUser(request);

  return withCouponTables(async (conn) => {
    const [rows] = await conn.execute<CouponRecord[]>(
      `SELECT id, code, title, description, discount_type, discount_value, min_order_amount, max_discount_amount,
              usage_limit, usage_count, starts_at, expires_at, is_active
       FROM coupons
       WHERE code = ?
       LIMIT 1`,
      [normalizedCode]
    );

    const coupon = rows?.[0];
    if (!coupon) {
      throw new Error("Coupon not found");
    }
    if (!coupon.is_active) {
      throw new Error("Coupon is inactive");
    }

    const [assignmentCountRows] = await conn.execute<Array<{ total: number }>>(
      `SELECT COUNT(*) AS total FROM coupon_assignments WHERE coupon_id = ?`,
      [coupon.id]
    );
    const hasAssignments = Number(assignmentCountRows?.[0]?.total || 0) > 0;

    let assignment: CouponAssignmentRecord | null = null;
    if (hasAssignments) {
      if (!user) {
        throw new Error("Sign in to use this coupon");
      }

      const [assignmentRows] = await conn.execute<CouponAssignmentRecord[]>(
        `SELECT id, acknowledged_at, used_at
         FROM coupon_assignments
         WHERE coupon_id = ?
           AND user_id = ?
         ORDER BY
           CASE WHEN used_at IS NULL THEN 0 ELSE 1 END,
           issued_at DESC
         LIMIT 1`,
        [coupon.id, user.id]
      );

      assignment = assignmentRows?.[0] ?? null;
      if (!assignment) {
        throw new Error("This coupon was not issued to your account");
      }
      if (assignment.used_at) {
        throw new Error("This coupon has already been used");
      }
      if (!assignment.acknowledged_at) {
        throw new Error("Confirm receipt of this coupon before applying it");
      }
    }

    const now = Date.now();
    const startsAtMs = parseTimestampMs(coupon.starts_at);
    const expiresAtMs = parseTimestampMs(coupon.expires_at);
    if (startsAtMs != null && now < startsAtMs) {
      throw new Error("Coupon is not active yet");
    }
    if (expiresAtMs != null && now > expiresAtMs) {
      throw new Error("Coupon has expired");
    }
    if (coupon.usage_limit != null && Number(coupon.usage_count) >= Number(coupon.usage_limit)) {
      throw new Error("Coupon usage limit reached");
    }
    if (subtotal < Number(coupon.min_order_amount || 0)) {
      throw new Error(`Minimum order for this coupon is $${Number(coupon.min_order_amount || 0).toFixed(2)}`);
    }

    const rawDiscount = coupon.discount_type === "percentage"
      ? subtotal * (Number(coupon.discount_value) / 100)
      : Number(coupon.discount_value);
    const cappedDiscount = coupon.max_discount_amount != null
      ? Math.min(rawDiscount, Number(coupon.max_discount_amount))
      : rawDiscount;
    const discountAmount = roundMoney(Math.min(subtotal, Math.max(0, cappedDiscount)));

    return {
      couponId: Number(coupon.id),
      assignmentId: assignment ? Number(assignment.id) : null,
      code: coupon.code,
      title: coupon.title,
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value),
      discountAmount,
    };
  });
}

export async function finalizeCouponRedemption(
  request: Request,
  orderId: number,
  couponCode: string,
  subtotal: number
): Promise<FinalizedCouponRedemption | null> {
  const normalizedCode = String(couponCode || "").trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  const validated = await validateCouponCode(request, normalizedCode, subtotal);

  await withCouponTables(async (conn) => {
    if (validated.assignmentId != null) {
      const [assignmentRows] = await conn.execute<Array<{ used_at: string | null }>>(
        `SELECT used_at
         FROM coupon_assignments
         WHERE id = ?
         LIMIT 1`,
        [validated.assignmentId]
      );
      const assignment = assignmentRows?.[0];
      if (!assignment) {
        throw new Error("Coupon assignment not found");
      }
      if (assignment.used_at) {
        throw new Error("This coupon has already been used");
      }
    }

    await conn.execute(
      `UPDATE coupons
       SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [validated.couponId]
    );

    if (validated.assignmentId != null) {
      await conn.execute(
        `UPDATE coupon_assignments
         SET used_at = CURRENT_TIMESTAMP,
             used_order_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [orderId, validated.assignmentId]
      );
    }
  });

  return {
    couponId: validated.couponId,
    assignmentId: validated.assignmentId,
    code: validated.code,
    discountAmount: validated.discountAmount,
  };
}
