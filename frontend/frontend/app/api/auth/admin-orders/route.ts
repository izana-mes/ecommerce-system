import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

type OrderStatus = "pending" | "processing" | "paid" | "shipped" | "completed" | "cancelled";
type PaymentStatus = "pending" | "authorized" | "paid" | "failed" | "refunded";

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

function toPositiveNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function isOrderStatus(value: string): value is OrderStatus {
  return ALLOWED_ORDER_STATUSES.includes(value as OrderStatus);
}

function isPaymentStatus(value: string): value is PaymentStatus {
  return ALLOWED_PAYMENT_STATUSES.includes(value as PaymentStatus);
}

export async function GET(request: Request) {
  const conn = await getConnection();

  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(0, toPositiveNumber(searchParams.get("page"), 1) - 1);
    const size = Math.min(100, toPositiveNumber(searchParams.get("size"), 10));
    const q = (searchParams.get("q") || "").trim();
    const orderStatus = (searchParams.get("orderStatus") || "").trim().toLowerCase();
    const paymentStatus = (searchParams.get("paymentStatus") || "").trim().toLowerCase();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();

    const whereParts: string[] = [];
    const whereParams: Array<string | number> = [];

    if (q) {
      whereParts.push("(LOWER(o.order_number) LIKE LOWER(?) OR LOWER(o.customer_email) LIKE LOWER(?))");
      const qLike = `%${q}%`;
      whereParams.push(qLike, qLike);
    }

    if (isOrderStatus(orderStatus)) {
      whereParts.push("o.order_status = ?");
      whereParams.push(orderStatus);
    }

    if (isPaymentStatus(paymentStatus)) {
      whereParts.push("o.payment_status = ?");
      whereParams.push(paymentStatus);
    }

    if (dateFrom) {
      whereParts.push("DATE(o.created_at) >= ?");
      whereParams.push(dateFrom);
    }

    if (dateTo) {
      whereParts.push("DATE(o.created_at) <= ?");
      whereParams.push(dateTo);
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [countRows] = await conn.execute<Array<{ total: number }>>(
      `SELECT COUNT(*) AS total
       FROM orders o
       ${whereSql}`,
      whereParams
    );

    const totalElements = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalElements / size));

    const [rows] = await conn.execute<
      Array<{
        id: number;
        order_number: string;
        customer_email: string;
        customer_first_name: string | null;
        customer_last_name: string | null;
        customer_phone: string | null;
        shipping_address_line1: string | null;
        shipping_address_line2: string | null;
        shipping_city: string | null;
        shipping_state: string | null;
        shipping_postal_code: string | null;
        shipping_country: string | null;
        notes: string | null;
        total_amount: number;
        currency: string;
        payment_method: string;
        payment_status: PaymentStatus;
        order_status: OrderStatus;
        item_count: number;
        created_at: string;
        updated_at: string;
      }>
    >(
      `SELECT
         o.id,
         o.order_number,
         o.customer_email,
         o.customer_first_name,
         o.customer_last_name,
         o.customer_phone,
         o.shipping_address_line1,
         o.shipping_address_line2,
         o.shipping_city,
         o.shipping_state,
         o.shipping_postal_code,
         o.shipping_country,
         o.notes,
         o.total_amount,
         o.currency,
         o.payment_method,
         o.payment_status,
         o.order_status,
         COALESCE(oi.total_items, 0) AS item_count,
         o.created_at,
         o.updated_at
       FROM orders o
       LEFT JOIN (
         SELECT order_id, SUM(quantity) AS total_items
         FROM order_items
         GROUP BY order_id
       ) oi ON oi.order_id = o.id
       ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, size, page * size]
    );

    return NextResponse.json({
      content: rows,
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
  } finally {
    await conn.end();
  }
}

export async function PATCH(request: Request) {
  const conn = await getConnection();

  try {
    const body = (await request.json()) as {
      orderId?: number;
      orderStatus?: string;
      paymentStatus?: string;
    };

    const orderId = Number(body?.orderId);
    const nextOrderStatus = (body?.orderStatus || "").trim().toLowerCase();
    const nextPaymentStatus = (body?.paymentStatus || "").trim().toLowerCase();

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
    }

    const hasOrderStatus = nextOrderStatus.length > 0;
    const hasPaymentStatus = nextPaymentStatus.length > 0;

    if (!hasOrderStatus && !hasPaymentStatus) {
      return NextResponse.json(
        { error: "Provide orderStatus and/or paymentStatus" },
        { status: 400 }
      );
    }

    if (hasOrderStatus && !isOrderStatus(nextOrderStatus)) {
      return NextResponse.json({ error: "Invalid orderStatus" }, { status: 400 });
    }

    if (hasPaymentStatus && !isPaymentStatus(nextPaymentStatus)) {
      return NextResponse.json({ error: "Invalid paymentStatus" }, { status: 400 });
    }

    await conn.beginTransaction();

    const [existingRows] = await conn.execute<Array<{ id: number }>>(
      "SELECT id FROM orders WHERE id = ? LIMIT 1",
      [orderId]
    );

    if (!existingRows?.length) {
      await conn.rollback();
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (hasOrderStatus || hasPaymentStatus) {
      const updates: string[] = [];
      const params: Array<string | number> = [];

      if (hasOrderStatus) {
        updates.push("order_status = ?");
        params.push(nextOrderStatus);
      }

      if (hasPaymentStatus) {
        updates.push("payment_status = ?");
        params.push(nextPaymentStatus);
      }

      updates.push("updated_at = CURRENT_TIMESTAMP");

      await conn.execute(
        `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`,
        [...params, orderId]
      );
    }

    if (hasPaymentStatus) {
      await conn.execute(
        `UPDATE payments
         SET status = ?,
             paid_at = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [nextPaymentStatus, nextPaymentStatus, orderId]
      );
    }

    const [updatedRows] = await conn.execute<
      Array<{
        id: number;
        order_number: string;
        customer_email: string;
        customer_first_name: string | null;
        customer_last_name: string | null;
        payment_status: PaymentStatus;
        order_status: OrderStatus;
        updated_at: string;
      }>
    >(
      `SELECT id, order_number, customer_email, customer_first_name, customer_last_name,
              payment_status, order_status, updated_at
       FROM orders
       WHERE id = ?
       LIMIT 1`,
      [orderId]
    );

    await conn.commit();

    // Fire-and-forget: publish order status changed notification via backend RabbitMQ
    const updatedOrder = updatedRows?.[0];
    if (updatedOrder) {
      const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
      const customerName = [updatedOrder.customer_first_name, updatedOrder.customer_last_name]
        .filter(Boolean)
        .join(" ");

      fetch(`${BACKEND_URL}/api/orders/status-changed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: String(updatedOrder.id),
          orderNumber: updatedOrder.order_number,
          customerEmail: updatedOrder.customer_email,
          customerName: customerName || "Customer",
          oldStatus: hasOrderStatus ? body.orderStatus : updatedOrder.order_status,
          newStatus: updatedOrder.order_status,
          oldPaymentStatus: hasPaymentStatus ? body.paymentStatus : updatedOrder.payment_status,
          newPaymentStatus: updatedOrder.payment_status,
        }),
      }).catch((err) => console.error("Failed to send status notification:", err));
    }

    return NextResponse.json({
      success: true,
      message: "Order updated successfully",
      data: updatedOrder || null,
    });
  } catch (error: unknown) {
    await conn.rollback();
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error updating admin order:", message);
    return NextResponse.json(
      { error: "Failed to update order", details: message },
      { status: 500 }
    );
  } finally {
    await conn.end();
  }
}

