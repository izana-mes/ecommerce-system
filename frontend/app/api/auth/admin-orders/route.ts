import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

type OrderStatus = "pending" | "processing" | "paid" | "shipped" | "completed" | "cancelled";
type PaymentStatus = "pending" | "authorized" | "paid" | "failed" | "refunded";
type BackendOrder = Record<string, unknown>;

const ALLOWED_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "paid",
  "shipped",
  "completed",
  "cancelled",
];

const ALLOWED_PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
];
const API_URL = backendApiBaseUrl();

function toPositiveNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function getAuthHeader(request: Request): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getCookieHeader(request: Request): string | null {
  return request.headers.get("cookie");
}

function normalizeOrder(item: BackendOrder) {
  const rawId = Number(item.id);
  const id = Number.isFinite(rawId) && rawId > 0 ? Math.floor(rawId) : 0;
  return {
    id,
    order_number: String(item.order_number ?? item.orderNumber ?? ""),
    customer_email: String(item.customer_email ?? item.customerEmail ?? ""),
    customer_first_name: String(item.customer_first_name ?? item.customerFirstName ?? "") || null,
    customer_last_name: String(item.customer_last_name ?? item.customerLastName ?? "") || null,
    customer_phone: String(item.customer_phone ?? item.customerPhone ?? "") || null,
    shipping_address_line1: String(item.shipping_address_line1 ?? item.shippingAddressLine1 ?? "") || null,
    shipping_address_line2: String(item.shipping_address_line2 ?? item.shippingAddressLine2 ?? "") || null,
    shipping_city: String(item.shipping_city ?? item.shippingCity ?? "") || null,
    shipping_state: String(item.shipping_state ?? item.shippingState ?? "") || null,
    shipping_postal_code: String(item.shipping_postal_code ?? item.shippingPostalCode ?? "") || null,
    shipping_country: String(item.shipping_country ?? item.shippingCountry ?? "") || null,
    notes: String(item.notes ?? "") || null,
    total_amount: Number(item.total_amount ?? item.totalAmount ?? 0),
    currency: String(item.currency ?? "USD"),
    payment_method: String(item.payment_method ?? item.paymentMethod ?? ""),
    payment_status: String(item.payment_status ?? item.paymentStatus ?? "pending"),
    order_status: String(item.order_status ?? item.orderStatus ?? "pending"),
    item_count: Number(item.item_count ?? item.itemCount ?? 0),
    created_at: String(item.created_at ?? item.createdAt ?? new Date().toISOString()),
    updated_at: String(item.updated_at ?? item.updatedAt ?? new Date().toISOString()),
    shipping_carrier:
      item.shipping_carrier != null || item.shippingCarrier != null
        ? String(item.shipping_carrier ?? item.shippingCarrier ?? "").trim() || null
        : null,
    shipping_tracking_public:
      item.shipping_tracking_public != null || item.shippingTrackingPublic != null
        ? String(item.shipping_tracking_public ?? item.shippingTrackingPublic ?? "").trim() || null
        : null,
    shipped_at:
      item.shipped_at != null || item.shippedAt != null
        ? String(item.shipped_at ?? item.shippedAt ?? "").trim() || null
        : null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = getAuthHeader(request);
    const cookieHeader = getCookieHeader(request);
    const page = Math.max(0, toPositiveNumber(searchParams.get("page"), 1) - 1);
    const size = Math.min(100, toPositiveNumber(searchParams.get("size"), 10));
    const q = (searchParams.get("q") || "").trim();
    const orderStatus = (searchParams.get("orderStatus") || "").trim().toLowerCase();
    const paymentStatus = (searchParams.get("paymentStatus") || "").trim().toLowerCase();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();
    const limit = Math.min(1000, Math.max(1, (page + 1) * size));

    const response = await fetch(`${API_URL}/orders/fulfillment-queue?limit=${limit}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });
    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.message ||
            payload?.error ||
            "Failed to fetch orders from backend",
        },
        { status: response.status }
      );
    }
    const sourceOrders: BackendOrder[] = Array.isArray(payload?.data)
      ? (payload.data as BackendOrder[])
      : [];
    let rows = sourceOrders.map((item: BackendOrder) => normalizeOrder(item));

    if (q) {
      const keyword = q.toLowerCase();
      rows = rows.filter(
        (row) =>
          String(row.order_number).toLowerCase().includes(keyword) ||
          String(row.customer_email).toLowerCase().includes(keyword)
      );
    }
    if (orderStatus) {
      rows = rows.filter((row) => String(row.order_status).toLowerCase() === orderStatus);
    }
    if (paymentStatus) {
      rows = rows.filter((row) => String(row.payment_status).toLowerCase() === paymentStatus);
    }
    if (dateFrom) {
      rows = rows.filter((row) => String(row.created_at).slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      rows = rows.filter((row) => String(row.created_at).slice(0, 10) <= dateTo);
    }

    const totalElements = rows.length;
    const content = rows.slice(page * size, page * size + size);
    const totalPages = Math.max(1, Math.ceil(totalElements / size));

    return NextResponse.json({
      content,
      totalElements,
      totalPages,
      number: page,
      size,
      allowedOrderStatuses: ALLOWED_ORDER_STATUSES,
      allowedPaymentStatuses: ALLOWED_PAYMENT_STATUSES,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching admin orders:", message);
    return NextResponse.json(
      { error: "Failed to fetch orders", details: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const authHeader = getAuthHeader(request);
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      orderId,
      orderStatus,
      paymentStatus,
      carrier,
      trackingNumber,
    } = body as Record<string, unknown>;

    if (!orderId || typeof orderId !== "number" || !Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Missing or invalid orderId" }, { status: 400 });
    }

    const patchBody: Record<string, string> = {};
    if (orderStatus && typeof orderStatus === "string") patchBody.orderStatus = orderStatus;
    if (paymentStatus && typeof paymentStatus === "string") patchBody.paymentStatus = paymentStatus;
    if ("carrier" in body && carrier !== undefined && (typeof carrier === "string" || carrier === null)) {
      patchBody.carrier = typeof carrier === "string" ? carrier : "";
    }
    if ("trackingNumber" in body && trackingNumber !== undefined && (typeof trackingNumber === "string" || trackingNumber === null)) {
      patchBody.trackingNumber = typeof trackingNumber === "string" ? trackingNumber : "";
    }

    if (Object.keys(patchBody).length === 0) {
      return NextResponse.json(
        { error: "At least one of orderStatus, paymentStatus, carrier, or trackingNumber must be provided" },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_URL}/v1/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(patchBody),
    });

    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error || payload?.message || "Failed to update order" },
        { status: response.status }
      );
    }

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error updating order:", message);
    return NextResponse.json(
      { error: "Failed to update order", details: message },
      { status: 500 }
    );
  }
}

