import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getInternalTokenHeader(): Record<string, string> {
  const token = process.env.INTERNAL_NOTIFY_TOKEN?.trim();
  return token ? { "X-Internal-Token": token } : {};
}

type OrderItemInput = {
  productID: string;
  productName: string;
  productPrice: number;
  quantity: number;
};

type CreateOrderRequest = {
  customerEmail: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  notes?: string;
  paymentMethod: string;
  orderSource?: "checkout-ui" | "buy-now" | string;
  currency?: string;
  shippingFee?: number;
  vat?: number;
  couponCode?: string;
  couponDiscount?: number;
  items: OrderItemInput[];
};

type AuthMeResponse = {
  data?: {
    email?: string;
  };
};

function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

function generateOrderNumber(): string {
  const stamp = Date.now().toString().slice(-10);
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `ORD-${stamp}-${random}`;
}

async function reserveStock(request: NextRequest, items: Array<{ productID: string; quantity: number }>) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const response = await fetch(`${API_URL}/products/stock/validate-reserve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...getInternalTokenHeader(),
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.message || data?.error || "Out of stock for one or more items";
    throw new Error(message);
  }
}

async function releaseStock(request: NextRequest, items: Array<{ productID: string; quantity: number }>) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  await fetch(`${API_URL}/products/stock/release`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...getInternalTokenHeader(),
    },
    body: JSON.stringify({ items }),
  });
}

function normalizeEmail(value: string | undefined | null): string {
  return String(value || "").trim().toLowerCase();
}

function trimToNull(value: string | undefined | null): string | null {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function resolveAuthenticatedEmail(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const cookieHeader = request.headers.get("cookie");

  if (!authHeader && !cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/v1/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json().catch(() => null)) as AuthMeResponse | null;
    const email = normalizeEmail(data?.data?.email);
    return email || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let conn: Awaited<ReturnType<typeof getConnection>> | null = null;
  let reservedItems: Array<{ productID: string; quantity: number }> = [];

  try {
    conn = await getConnection();
    const body = (await request.json()) as CreateOrderRequest;
    const orderSource = String(body.orderSource || "checkout-ui").trim().toLowerCase();
    const normalizedOrderSource = orderSource === "buy-now" ? "buy-now" : "checkout-ui";
    const authenticatedEmail = await resolveAuthenticatedEmail(request);
    const payloadEmail = normalizeEmail(body?.customerEmail);
    const effectiveEmail = payloadEmail || authenticatedEmail;

    const customerFirstName = trimToNull(body.customerFirstName);
    const customerLastName = trimToNull(body.customerLastName);
    const customerPhone = trimToNull(body.customerPhone);
    const shippingAddressLine1 = trimToNull(body.shippingAddressLine1);
    const shippingAddressLine2 = trimToNull(body.shippingAddressLine2);
    const shippingCity = trimToNull(body.shippingCity);
    const shippingState = trimToNull(body.shippingState);
    const shippingPostalCode = trimToNull(body.shippingPostalCode);
    const shippingCountry = trimToNull(body.shippingCountry);
    const notes = trimToNull(body.notes);
    const paymentMethod = String(body.paymentMethod || "").trim();
    const couponCode = String(body.couponCode || "").trim().toUpperCase();
    const couponDiscount = Number(body.couponDiscount ?? 0);

    if (!effectiveEmail || !paymentMethod || !Array.isArray(body?.items)) {
      return NextResponse.json(
        { error: "Missing required fields: customerEmail, paymentMethod, items" },
        { status: 400 }
      );
    }

    if (!isValidEmail(effectiveEmail)) {
      return NextResponse.json({ error: "Invalid customerEmail format" }, { status: 400 });
    }

    if (normalizedOrderSource === "checkout-ui") {
      const missingFields: string[] = [];
      if (!customerFirstName) missingFields.push("customerFirstName");
      if (!customerLastName) missingFields.push("customerLastName");
      if (!customerPhone) missingFields.push("customerPhone");
      if (!shippingAddressLine1) missingFields.push("shippingAddressLine1");
      if (!shippingCity) missingFields.push("shippingCity");
      if (!shippingPostalCode) missingFields.push("shippingPostalCode");
      if (!shippingCountry) missingFields.push("shippingCountry");

      if (missingFields.length > 0) {
        return NextResponse.json(
          { error: `Missing required checkout fields: ${missingFields.join(", ")}` },
          { status: 400 }
        );
      }
    }

    if (body.items.length === 0) {
      return NextResponse.json({ error: "Order items cannot be empty" }, { status: 400 });
    }

    const safeItems = body.items
      .filter((item) => item.productID && item.productName && Number(item.quantity) > 0)
      .map((item) => ({
        productID: item.productID,
        productName: item.productName,
        quantity: Number(item.quantity),
        unitPrice: Number(item.productPrice),
      }));

    if (safeItems.length === 0) {
      return NextResponse.json({ error: "No valid order items found" }, { status: 400 });
    }

    if (normalizedOrderSource === "buy-now" && safeItems.length !== 1) {
      return NextResponse.json(
        { error: "Buy now orders must contain exactly one product" },
        { status: 400 }
      );
    }

    reservedItems = safeItems.map((item) => ({
      productID: item.productID,
      quantity: item.quantity,
    }));
    await reserveStock(request, reservedItems);

    const subtotal = toMoney(
      safeItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    );
    const shippingFee = toMoney(body.shippingFee ?? (subtotal > 0 ? 5 : 0));
    const vat = toMoney(body.vat ?? (subtotal > 0 ? 11 : 0));
    const safeCouponDiscount = Number.isFinite(couponDiscount)
      ? Math.max(0, Math.min(couponDiscount, subtotal))
      : 0;
    const totalAmount = toMoney(subtotal + shippingFee + vat - safeCouponDiscount);
    const currency = (body.currency || "USD").toUpperCase().slice(0, 3);
    const orderNumber = generateOrderNumber();

    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO orders (
        order_number, user_id, customer_email, customer_first_name, customer_last_name, customer_phone,
        shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_postal_code, shipping_country,
        notes, subtotal, shipping_fee, vat, total_amount, currency, payment_method, payment_status, order_status
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
      [
        orderNumber,
        effectiveEmail,
        customerFirstName,
        customerLastName,
        customerPhone,
        shippingAddressLine1,
        shippingAddressLine2,
        shippingCity,
        shippingState,
        shippingPostalCode,
        shippingCountry,
        notes,
        subtotal,
        shippingFee,
        vat,
        totalAmount,
        currency,
        paymentMethod,
      ]
    );

    const [orderRows] = await conn.execute<Array<{ id: number }>>(
      "SELECT id FROM orders WHERE order_number = ? LIMIT 1",
      [orderNumber]
    );
    const orderId = Number(orderRows?.[0]?.id);

    if (!orderId) {
      throw new Error("Cannot resolve created order id");
    }

    for (const item of safeItems) {
      const lineTotal = toMoney(item.unitPrice * item.quantity);
      await conn.execute(
        `INSERT INTO order_items (
          order_id, product_id, product_name, unit_price, quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.productID, item.productName, item.unitPrice, item.quantity, lineTotal]
      );
    }

    await conn.execute(
      `INSERT INTO payments (
        order_id, payment_reference, provider, method, amount, currency, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        orderId,
        orderNumber,
        "manual",
        paymentMethod,
        totalAmount,
        currency,
        JSON.stringify({ source: normalizedOrderSource }),
      ]
    );

    if (couponCode && safeCouponDiscount > 0) {
      await conn.execute(
        `UPDATE coupons
         SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
         WHERE code = ?`,
        [couponCode]
      );
    }

    await conn.commit();

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId,
          orderNumber,
          subtotal,
          shippingFee,
          vat,
          discount: safeCouponDiscount,
          totalAmount,
          currency,
          paymentStatus: "pending",
          orderStatus: "pending",
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (conn) {
      await conn.rollback().catch(() => undefined);
    }
    if (reservedItems.length > 0) {
      await releaseStock(request, reservedItems);
    }
    const message = error instanceof Error ? error.message : "Failed to create order";
    const status = /stock|out of stock|insufficient/i.test(message) ? 409 : 500;
    console.error("Error creating order:", message);
    return NextResponse.json(
      { error: message },
      { status }
    );
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}
