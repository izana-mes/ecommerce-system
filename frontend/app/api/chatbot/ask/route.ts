import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

type AskRequestBody = {
  question?: string;
};

type AuthProfile = {
  role?: string;
  roles?: string[];
};

type ChatResult = {
  intent: string;
  answer: string;
  evidence?: Record<string, unknown>;
};

const ORDER_NUMBER_PATTERN = /\b([A-Z]{2,}[A-Z0-9_-]{2,})\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function getAuthHeader(request: Request): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getCookieHeader(request: Request): string | null {
  return request.headers.get("cookie") || null;
}

function normalizeRole(profile: AuthProfile | null | undefined): "admin" | "employee" | "user" {
  const rawRole = String(profile?.role || "").toLowerCase();
  if (rawRole === "admin") return "admin";
  if (rawRole === "employee" || rawRole === "staff") return "employee";

  const roles = Array.isArray(profile?.roles) ? profile.roles.map((value) => value.toUpperCase()) : [];
  if (roles.includes("ROLE_ADMIN")) return "admin";
  if (roles.includes("ROLE_EMPLOYEE") || roles.includes("ROLE_STAFF")) return "employee";

  return "user";
}

function isPrivilegedRole(role: "admin" | "employee" | "user"): boolean {
  return role === "admin" || role === "employee";
}

async function authorizePrivilegedUser(request: Request): Promise<{
  ok: boolean;
  role?: "admin" | "employee" | "user";
  status?: number;
  message?: string;
}> {
  const authHeader = getAuthHeader(request);
  const cookieHeader = getCookieHeader(request);

  if (!authHeader && !cookieHeader) {
    return { ok: false, status: 401, message: "Missing authentication" };
  }

  const apiBase = backendApiBaseUrl();

  try {
    const response = await fetch(`${apiBase}/v1/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status || 401,
        message: data?.message || "Authentication failed",
      };
    }

    const role = normalizeRole(data?.data as AuthProfile);
    if (!isPrivilegedRole(role)) {
      return {
        ok: false,
        role,
        status: 403,
        message: "Only staff and administrators can use this chatbot",
      };
    }

    return { ok: true, role };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 500, message };
  }
}

function normalizeQuestion(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function formatMoney(value: unknown, currency = "USD"): string {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return `${currency} 0.00`;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function toIsoDate(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function extractEmail(question: string): string | null {
  const match = question.match(EMAIL_PATTERN);
  return match ? match[0].toLowerCase() : null;
}

function extractOrderNumber(question: string): string | null {
  const match = question.match(ORDER_NUMBER_PATTERN);
  return match ? match[1].toUpperCase() : null;
}

function isOrderIntent(question: string): boolean {
  return /\border\b|\bstatus\b|\btracking\b|\bpayment\b/i.test(question);
}

function isLowStockIntent(question: string): boolean {
  return /low stock|out of stock|inventory alert|stock alert|stock level/i.test(question);
}

function isTopSellingIntent(question: string): boolean {
  return /top selling|best selling|best seller|most sold|top products/i.test(question);
}

function isRevenueIntent(question: string): boolean {
  return /revenue|sales total|gmv|income/i.test(question);
}

function isCatalogIntent(question: string): boolean {
  return /price|catalog|product|inventory|stock/i.test(question);
}

async function resolveOrderLookup(
  conn: Awaited<ReturnType<typeof getConnection>>,
  question: string
): Promise<ChatResult | null> {
  const email = extractEmail(question);
  const orderNumber = extractOrderNumber(question);

  if (!email && !orderNumber) {
    return null;
  }

  if (orderNumber) {
    const [orders] = await conn.execute<
      Array<{
        order_number: string;
        customer_email: string;
        order_status: string;
        payment_status: string;
        total_amount: number;
        currency: string;
        created_at: string;
      }>
    >(
      `SELECT order_number, customer_email, order_status, payment_status, total_amount, currency, created_at
       FROM orders
       WHERE UPPER(order_number) = UPPER(?)
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderNumber]
    );

    const order = orders?.[0];
    if (order) {
      return {
        intent: "order_lookup",
        answer: `Order ${order.order_number} is ${order.order_status} with payment ${order.payment_status}. Total is ${formatMoney(
          order.total_amount,
          order.currency
        )}, created at ${toIsoDate(order.created_at)} for ${order.customer_email}.`,
        evidence: {
          orderNumber: order.order_number,
          orderStatus: order.order_status,
          paymentStatus: order.payment_status,
          totalAmount: order.total_amount,
          currency: order.currency,
          customerEmail: order.customer_email,
          createdAt: order.created_at,
        },
      };
    }
  }

  if (email) {
    const [orders] = await conn.execute<
      Array<{
        order_number: string;
        order_status: string;
        payment_status: string;
        total_amount: number;
        currency: string;
        created_at: string;
      }>
    >(
      `SELECT order_number, order_status, payment_status, total_amount, currency, created_at
       FROM orders
       WHERE LOWER(customer_email) = LOWER(?)
       ORDER BY created_at DESC
       LIMIT 5`,
      [email]
    );

    if (!orders.length) {
      return {
        intent: "customer_orders",
        answer: `I couldn't find orders for ${email}.`,
        evidence: { customerEmail: email, orderCount: 0 },
      };
    }

    const lines = orders.map((order) => {
      return `${order.order_number}: ${order.order_status}/${order.payment_status}, ${formatMoney(
        order.total_amount,
        order.currency
      )}, ${toIsoDate(order.created_at)}`;
    });

    return {
      intent: "customer_orders",
      answer: `Recent orders for ${email}: ${lines.join(" | ")}`,
      evidence: {
        customerEmail: email,
        orderCount: orders.length,
        orders,
      },
    };
  }

  return null;
}

async function resolveLowStock(
  conn: Awaited<ReturnType<typeof getConnection>>
): Promise<ChatResult> {
  const [rows] = await conn.execute<
    Array<{
      product_id: string;
      product_name: string;
      stock_quantity: number;
      active: boolean;
    }>
  >(
    `SELECT product_id, product_name, stock_quantity, active
     FROM products
     WHERE active = TRUE
     ORDER BY stock_quantity ASC, product_id ASC
     LIMIT 10`
  );

  if (!rows.length) {
    return {
      intent: "low_stock",
      answer: "No active products were found in the catalog.",
      evidence: { products: [] },
    };
  }

  const critical = rows.filter((item) => Number(item.stock_quantity) <= 5);
  const summarized = (critical.length ? critical : rows.slice(0, 5)).map(
    (item) => `${item.product_name} (${item.product_id}) => stock ${item.stock_quantity}`
  );

  return {
    intent: "low_stock",
    answer: `Current low-stock view: ${summarized.join(" | ")}`,
    evidence: {
      criticalCount: critical.length,
      products: rows,
    },
  };
}

async function resolveTopSelling(
  conn: Awaited<ReturnType<typeof getConnection>>
): Promise<ChatResult> {
  const [rows] = await conn.execute<
    Array<{
      product_id: string;
      product_name: string;
      sold_qty: number;
      revenue: number;
    }>
  >(
    `SELECT product_id, product_name, SUM(quantity) AS sold_qty, SUM(line_total) AS revenue
     FROM order_items
     GROUP BY product_id, product_name
     ORDER BY sold_qty DESC
     LIMIT 5`
  );

  if (!rows.length) {
    return {
      intent: "top_selling",
      answer: "No order item data is available yet.",
      evidence: { products: [] },
    };
  }

  return {
    intent: "top_selling",
    answer: `Top selling products: ${rows
      .map((item) => `${item.product_name} (${item.product_id}) sold ${item.sold_qty}`)
      .join(" | ")}`,
    evidence: { products: rows },
  };
}

async function resolveRevenue(
  conn: Awaited<ReturnType<typeof getConnection>>
): Promise<ChatResult> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [rows] = await conn.execute<
    Array<{
      total_orders: number;
      total_revenue: number;
      paid_orders: number;
    }>
  >(
    `SELECT
      COUNT(*) AS total_orders,
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN 1 ELSE 0 END) AS paid_orders
     FROM orders
     WHERE created_at >= ?`,
    [since]
  );

  const row = rows?.[0] || { total_orders: 0, total_revenue: 0, paid_orders: 0 };
  return {
    intent: "revenue",
    answer: `In the last 30 days: ${row.total_orders} orders, ${row.paid_orders} paid orders, total revenue ${formatMoney(
      row.total_revenue,
      "USD"
    )}.`,
    evidence: {
      since,
      totalOrders: Number(row.total_orders || 0),
      paidOrders: Number(row.paid_orders || 0),
      totalRevenue: Number(row.total_revenue || 0),
    },
  };
}

function extractCatalogKeyword(question: string): string {
  const lowered = question.toLowerCase();
  return lowered
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(price|product|inventory|stock|for|of|show|find|details|about|the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function resolveCatalog(
  conn: Awaited<ReturnType<typeof getConnection>>,
  question: string
): Promise<ChatResult> {
  const keyword = extractCatalogKeyword(question);

  const [rows] = await conn.execute<
    Array<{
      product_id: string;
      product_name: string;
      product_price: number;
      stock_quantity: number;
      active: boolean;
    }>
  >(
    `SELECT product_id, product_name, product_price, stock_quantity, active
     FROM products
     WHERE LOWER(product_name) LIKE LOWER(?)
     ORDER BY active DESC, stock_quantity DESC
     LIMIT 5`,
    [`%${keyword || question}%`]
  );

  if (!rows.length) {
    return {
      intent: "catalog_lookup",
      answer: "I couldn't find matching products for that catalog question.",
      evidence: { keyword, products: [] },
    };
  }

  return {
    intent: "catalog_lookup",
    answer: `Matching products: ${rows
      .map(
        (item) =>
          `${item.product_name} (${item.product_id}) price ${formatMoney(item.product_price, "USD")}, stock ${
            item.stock_quantity
          }`
      )
      .join(" | ")}`,
    evidence: {
      keyword,
      products: rows,
    },
  };
}

async function resolveDefault(
  conn: Awaited<ReturnType<typeof getConnection>>
): Promise<ChatResult> {
  const [orderStats] = await conn.execute<Array<{ total_orders: number; pending_orders: number }>>(
    `SELECT
      COUNT(*) AS total_orders,
      SUM(CASE WHEN LOWER(order_status) = 'pending' THEN 1 ELSE 0 END) AS pending_orders
     FROM orders`
  );

  const [productStats] = await conn.execute<Array<{ total_products: number; low_stock_count: number }>>(
    `SELECT
      COUNT(*) AS total_products,
      SUM(CASE WHEN stock_quantity <= 5 THEN 1 ELSE 0 END) AS low_stock_count
     FROM products
     WHERE active = TRUE`
  );

  const orders = orderStats?.[0] || { total_orders: 0, pending_orders: 0 };
  const products = productStats?.[0] || { total_products: 0, low_stock_count: 0 };

  return {
    intent: "summary",
    answer:
      `Live summary: ${Number(orders.total_orders || 0)} total orders, ` +
      `${Number(orders.pending_orders || 0)} pending orders, ` +
      `${Number(products.total_products || 0)} active products, ` +
      `${Number(products.low_stock_count || 0)} low-stock products. ` +
      "Try asking about an order number, customer email, low stock, top selling products, revenue, or product prices.",
    evidence: {
      totalOrders: Number(orders.total_orders || 0),
      pendingOrders: Number(orders.pending_orders || 0),
      activeProducts: Number(products.total_products || 0),
      lowStockProducts: Number(products.low_stock_count || 0),
    },
  };
}

async function buildAnswer(
  conn: Awaited<ReturnType<typeof getConnection>>,
  question: string
): Promise<ChatResult> {
  const normalized = normalizeQuestion(question);

  const orderLookup = await resolveOrderLookup(conn, normalized);
  if (orderLookup) {
    return orderLookup;
  }

  if (isLowStockIntent(normalized)) {
    return resolveLowStock(conn);
  }

  if (isTopSellingIntent(normalized)) {
    return resolveTopSelling(conn);
  }

  if (isRevenueIntent(normalized)) {
    return resolveRevenue(conn);
  }

  if (isOrderIntent(normalized)) {
    return resolveDefault(conn);
  }

  if (isCatalogIntent(normalized)) {
    return resolveCatalog(conn, normalized);
  }

  return resolveDefault(conn);
}

export async function POST(request: Request) {
  const access = await authorizePrivilegedUser(request);
  if (!access.ok) {
    return NextResponse.json(
      {
        error: access.message || "Unauthorized",
      },
      { status: access.status || 401 }
    );
  }

  let body: AskRequestBody;
  try {
    body = (await request.json()) as AskRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = normalizeQuestion(String(body.question || ""));
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  let conn: Awaited<ReturnType<typeof getConnection>> | undefined;

  try {
    conn = await getConnection();
    const result = await buildAnswer(conn, question);

    return NextResponse.json({
      role: access.role,
      question,
      intent: result.intent,
      answer: result.answer,
      evidence: result.evidence,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to answer question from database",
        details: message,
      },
      { status: 500 }
    );
  } finally {
    await conn?.end();
  }
}
