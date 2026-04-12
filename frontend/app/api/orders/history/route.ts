import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

type OrderRow = {
  id: number;
  order_number: string;
  customer_email: string;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  subtotal: number;
  shipping_fee: number;
  vat: number;
  total_amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  order_id: number;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

function getAuthHeader(request: Request): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getCookieHeader(request: Request): string | null {
  return request.headers.get("cookie");
}

function toInt(input: string | null, fallback: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function normalizeEmail(value: string | undefined | null): string {
  return String(value || "").trim().toLowerCase();
}

export async function GET(request: Request) {
  const authHeader = getAuthHeader(request);
  const cookieHeader = getCookieHeader(request);

  if (!authHeader && !cookieHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const meResponse = await fetch(`${API_URL}/v1/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });
    const meData = await meResponse.json().catch(() => null);
    const email = normalizeEmail(meData?.data?.email as string | undefined);

    if (!meResponse.ok || !email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = toInt(searchParams.get("page"), 0);
    const size = Math.min(50, Math.max(1, toInt(searchParams.get("size"), 10)));
    const offset = page * size;

    const conn = await getConnection();
    try {
      const [countRows] = await conn.execute<Array<{ total: number }>>(
        "SELECT COUNT(*) AS total FROM orders WHERE LOWER(TRIM(customer_email)) = ?",
        [email]
      );
      const totalElements = Number(countRows?.[0]?.total || 0);

      const [orders] = await conn.execute<OrderRow[]>(
        `SELECT id, order_number, customer_email, customer_first_name, customer_last_name,
                subtotal, shipping_fee, vat, total_amount, currency,
                payment_method, payment_status, order_status, created_at, updated_at
         FROM orders
         WHERE LOWER(TRIM(customer_email)) = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [email, size, offset]
      );

      if (!orders.length) {
        return NextResponse.json({
          content: [],
          totalElements,
          totalPages: Math.max(1, Math.ceil(totalElements / size)),
          number: page,
          size,
        });
      }

      const orderIds = orders.map((order) => order.id);
      const placeholders = orderIds.map(() => "?").join(", ");
      const [items] = await conn.execute<OrderItemRow[]>(
        `SELECT order_id, product_id, product_name, unit_price, quantity, line_total
         FROM order_items
         WHERE order_id IN (${placeholders})
         ORDER BY id ASC`,
        orderIds
      );

      const itemsByOrderId = new Map<number, OrderItemRow[]>();
      for (const item of items) {
        const list = itemsByOrderId.get(item.order_id) || [];
        list.push(item);
        itemsByOrderId.set(item.order_id, list);
      }

      const content = orders.map((order) => ({
        ...order,
        items: itemsByOrderId.get(order.id) || [],
      }));

      return NextResponse.json({
        content,
        totalElements,
        totalPages: Math.max(1, Math.ceil(totalElements / size)),
        number: page,
        size,
      });
    } finally {
      await conn.end();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching order history:", message);
    return NextResponse.json(
      { error: "Failed to fetch order history", details: message },
      { status: 500 }
    );
  }
}
