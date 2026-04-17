import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { createVnpSecureHash } from "@/lib/vnpay";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

type OrderRow = {
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
  subtotal: number;
  shipping_fee: number;
  vat: number;
  total_amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
};

type PaymentRow = {
  metadata: string | null;
};

type OrderItemRow = {
  order_id: number;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

type NotificationOrderItem = {
  productID: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

type SendOrderPaidEmailPayload = {
  to: string;
  orderNumber: string;
  currency: string;
  subtotal: number;
  shippingFee: number;
  vat: number;
  totalAmount: number;
  paymentMethod: string;
  customerEmail: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerPhone: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  notes: string | null;
  items: NotificationOrderItem[];
};

type SendOrderPaidEmailResult = {
  ok: boolean;
  status?: number;
  message?: string;
};

async function sendOrderPaidEmail(
  payload: SendOrderPaidEmailPayload
): Promise<SendOrderPaidEmailResult> {
  const notifyToken = process.env.INTERNAL_NOTIFY_TOKEN?.trim();
  try {
    const response = await fetch(`${API_URL}/internal/notifications/order-paid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(notifyToken ? { "X-Internal-Token": notifyToken } : {}),
      },
      body: JSON.stringify(payload),
    });
    const responseBody = await response.text().catch(() => "");
    return {
      ok: response.ok,
      status: response.status,
      message: responseBody || undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      "Failed to call order-paid notification endpoint:",
      message
    );
    return {
      ok: false,
      message,
    };
  }
}

export async function GET(request: NextRequest) {
  const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
  if (!hashSecret) {
    return NextResponse.json({ valid: false, message: "Missing config" }, { status: 500 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const secureHash = params.vnp_SecureHash;
  const txnRef = params.vnp_TxnRef;
  const amount = Number(params.vnp_Amount || 0);
  const responseCode = params.vnp_ResponseCode;
  const transactionStatus = params.vnp_TransactionStatus;
  const transactionNo = params.vnp_TransactionNo;

  if (!secureHash || !txnRef) {
    return NextResponse.json({ valid: false, message: "Missing required params" }, { status: 400 });
  }

  const rest = { ...params };
  delete rest.vnp_SecureHash;
  delete rest.vnp_SecureHashType;
  const computed = createVnpSecureHash(rest, hashSecret);
  const valid = computed.toLowerCase() === String(secureHash).toLowerCase();

  if (!valid) {
    return NextResponse.json({ valid: false, message: "Invalid signature" }, { status: 400 });
  }

  let conn: Awaited<ReturnType<typeof getConnection>> | null = null;
  try {
    conn = await getConnection();
    const [rows] = await conn.execute<OrderRow[]>(
      `SELECT id, order_number, customer_email, customer_first_name, customer_last_name, customer_phone,
              shipping_address_line1, shipping_address_line2, shipping_city, shipping_state,
              shipping_postal_code, shipping_country, notes, subtotal, shipping_fee, vat,
              total_amount, currency, payment_method, payment_status, order_status
       FROM orders
       WHERE order_number = ?
       LIMIT 1`,
      [txnRef]
    );

    const order = rows[0];
    if (!order) {
      return NextResponse.json({ valid: true, success: false, message: "Order not found" }, { status: 404 });
    }
    const [paymentRows] = await conn.execute<PaymentRow[]>(
      "SELECT metadata FROM payments WHERE order_id = ? LIMIT 1",
      [order.id]
    );
    const existingMetadata = parseMetadata(paymentRows?.[0]?.metadata ?? null);
    const alreadySentConfirmationEmail = Boolean(existingMetadata?.orderConfirmationEmailSentAt);
    const [itemRows] = await conn.execute<OrderItemRow[]>(
      `SELECT order_id, product_id, product_name, unit_price, quantity, line_total
       FROM order_items
       WHERE order_id = ?
       ORDER BY id ASC`,
      [order.id]
    );
    const source = String(existingMetadata?.source || "").trim().toLowerCase();
    const shouldClearCart = source === "checkout-ui";
    const shouldRemoveBoughtItems = source === "buy-now";

    const usdToVndRate = Number(process.env.VNPAY_USD_TO_VND_RATE || 26000);
    const orderCurrency = String(order.currency || "VND").toUpperCase();

    let expectedAmountVnd = Number(order.total_amount);
    if (orderCurrency !== "VND") {
      if (orderCurrency === "USD") {
        expectedAmountVnd = expectedAmountVnd * usdToVndRate;
      } else {
        return NextResponse.json(
          { valid: true, success: false, message: `Unsupported currency for VNPAY: ${orderCurrency}` },
          { status: 400 }
        );
      }
    }

    if (Math.round(expectedAmountVnd * 100) !== amount) {
      return NextResponse.json(
        { valid: true, success: false, message: "Order amount mismatch" },
        { status: 400 }
      );
    }

    const paid = responseCode === "00" && transactionStatus === "00";
    const paymentStatus = paid ? "paid" : "failed";
    const orderStatus = paid ? "paid" : "cancelled";

    if (order.payment_status !== "paid") {
      await conn.beginTransaction();
      await conn.execute(
        "UPDATE orders SET payment_status = ?, order_status = ? WHERE id = ?",
        [paymentStatus, orderStatus, order.id]
      );
      await conn.execute(
        `UPDATE payments
         SET provider = 'vnpay',
             method = 'VNPAY',
             payment_reference = ?,
             status = ?,
             paid_at = ?,
             metadata = ?::jsonb
         WHERE order_id = ?`,
        [
          transactionNo || txnRef,
          paymentStatus,
          paid ? new Date() : null,
          JSON.stringify({ ...existingMetadata, return: rest }),
          order.id,
        ]
      );
      await conn.commit();
    }

    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const cookieHeader = request.headers.get("cookie");
    const boughtProductIds = Array.from(new Set(itemRows.map((item) => String(item.product_id || "").trim()).filter(Boolean)));
    let removedProductIDs: string[] = [];

    if (paid && shouldClearCart) {
      try {
        await fetch(`${API_URL}/cart/clear`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        });
      } catch (clearCartError) {
        console.error(
          "Payment succeeded but failed to clear cart:",
          clearCartError instanceof Error ? clearCartError.message : String(clearCartError)
        );
      }
    }

    if (paid && shouldRemoveBoughtItems && boughtProductIds.length > 0) {
      const removeResults = await Promise.allSettled(
        boughtProductIds.map(async (productID) => {
          const response = await fetch(`${API_URL}/cart/${encodeURIComponent(productID)}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              ...(authHeader ? { Authorization: authHeader } : {}),
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
          });
          if (!response.ok) {
            throw new Error(`Failed to remove ${productID} from cart`);
          }
          return productID;
        })
      );

      removedProductIDs = removeResults
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value);
    }

    let confirmationEmailSent = alreadySentConfirmationEmail;
    let confirmationEmailError: string | null = null;
    if (paid && !alreadySentConfirmationEmail) {
      const sendResult = await sendOrderPaidEmail({
        to: order.customer_email,
        orderNumber: order.order_number,
        currency: order.currency,
        subtotal: Number(order.subtotal || 0),
        shippingFee: Number(order.shipping_fee || 0),
        vat: Number(order.vat || 0),
        totalAmount: Number(order.total_amount || 0),
        paymentMethod: order.payment_method,
        customerEmail: order.customer_email,
        customerFirstName: order.customer_first_name,
        customerLastName: order.customer_last_name,
        customerPhone: order.customer_phone,
        shippingAddressLine1: order.shipping_address_line1,
        shippingAddressLine2: order.shipping_address_line2,
        shippingCity: order.shipping_city,
        shippingState: order.shipping_state,
        shippingPostalCode: order.shipping_postal_code,
        shippingCountry: order.shipping_country,
        notes: order.notes,
        items: itemRows.map((item) => ({
          productID: item.product_id,
          productName: item.product_name,
          unitPrice: Number(item.unit_price || 0),
          quantity: Number(item.quantity || 0),
          lineTotal: Number(item.line_total || 0),
        })),
      });

      if (sendResult.ok) {
        confirmationEmailSent = true;
        try {
          await conn.execute(
            "UPDATE payments SET metadata = ?::jsonb WHERE order_id = ?",
            [
              JSON.stringify({
                ...existingMetadata,
                return: rest,
                orderConfirmationEmailSentAt: new Date().toISOString(),
              }),
              order.id,
            ]
          );
        } catch (metadataUpdateError) {
          console.error(
            "Failed to persist order confirmation email flag:",
            metadataUpdateError instanceof Error
              ? metadataUpdateError.message
              : String(metadataUpdateError)
          );
        }
      } else {
        confirmationEmailError =
          sendResult.message ||
          (sendResult.status ? `notification_api_status_${sendResult.status}` : "notification_failed");
      }
    }

    return NextResponse.json({
      valid: true,
      success: paid,
      clearCart: paid && shouldClearCart,
      removedProductIDs,
      confirmationEmailSent,
      confirmationEmailError,
      orderNumber: txnRef,
      message: paid ? "Payment successful" : "Payment failed",
      order: {
        id: order.id,
        orderNumber: order.order_number,
        customerEmail: order.customer_email,
        customerFirstName: order.customer_first_name,
        customerLastName: order.customer_last_name,
        customerPhone: order.customer_phone,
        shippingAddressLine1: order.shipping_address_line1,
        shippingAddressLine2: order.shipping_address_line2,
        shippingCity: order.shipping_city,
        shippingState: order.shipping_state,
        shippingPostalCode: order.shipping_postal_code,
        shippingCountry: order.shipping_country,
        notes: order.notes,
        subtotal: Number(order.subtotal || 0),
        shippingFee: Number(order.shipping_fee || 0),
        vat: Number(order.vat || 0),
        totalAmount: Number(order.total_amount || 0),
        currency: order.currency,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        orderStatus: order.order_status,
        items: itemRows.map((item) => ({
          productID: item.product_id,
          productName: item.product_name,
          unitPrice: Number(item.unit_price || 0),
          quantity: Number(item.quantity || 0),
          lineTotal: Number(item.line_total || 0),
        })),
      },
    });
  } catch (error: unknown) {
    if (conn) {
      await conn.rollback().catch(() => undefined);
    }
    console.error("VNPAY return verify error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ valid: false, message: "Server error" }, { status: 500 });
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}
