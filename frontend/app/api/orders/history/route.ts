import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

type BackendOrder = {
  orderNumber?: string;
  totalAmount?: number;
  currency?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  orderStatus?: string;
  createdAt?: string;
  itemCount?: number;
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

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const raw = await response.text().catch(() => "");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const authHeader = getAuthHeader(request);
  const cookieHeader = getCookieHeader(request);

  if (!authHeader && !cookieHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = toInt(searchParams.get("page"), 0);
    const size = Math.min(50, Math.max(1, toInt(searchParams.get("size"), 10)));

    // Backend endpoint supports limit only; fetch enough records for requested page and slice here.
    const requestedLimit = Math.min(100, (page + 1) * size);
    const response = await fetch(`${API_URL}/orders/history?limit=${requestedLimit}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    const data = await parseJsonSafely<{
      message?: string;
      error?: string;
      data?: BackendOrder[];
    }>(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.message || data?.error || "Failed to fetch order history" },
        { status: response.status }
      );
    }

    const allOrders = Array.isArray(data?.data) ? data.data : [];
    const start = page * size;
    const pagedOrders = allOrders.slice(start, start + size);

    const content = pagedOrders.map((order, index) => ({
      id: start + index + 1,
      order_number: order.orderNumber ?? `ORDER-${start + index + 1}`,
      subtotal: Number(order.totalAmount ?? 0),
      shipping_fee: 0,
      vat: 0,
      total_amount: Number(order.totalAmount ?? 0),
      currency: String(order.currency ?? "USD"),
      payment_method: String(order.paymentMethod ?? "unknown"),
      payment_status: String(order.paymentStatus ?? "pending"),
      order_status: String(order.orderStatus ?? "pending"),
      created_at: order.createdAt ?? new Date().toISOString(),
      items: [],
    }));

    const totalElements = allOrders.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / size));

    return NextResponse.json({
      content,
      totalElements,
      totalPages,
      number: page,
      size,
    });
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to fetch order history",
        details,
      },
      { status: 500 }
    );
  }
}
