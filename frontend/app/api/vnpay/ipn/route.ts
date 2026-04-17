import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { createVnpSecureHash } from "@/lib/vnpay";

type OrderRow = {
  id: number;
  total_amount: number;
  payment_status: string;
  order_status: string;
};

type PaymentRow = {
  metadata: string | null;
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

function jsonRsp(RspCode: string, Message: string) {
  return NextResponse.json({ RspCode, Message });
}

export async function GET(request: NextRequest) {
  const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
  if (!hashSecret) {
    return jsonRsp("99", "Missing config");
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const secureHash = params.vnp_SecureHash;
  const txnRef = params.vnp_TxnRef;
  const amount = Number(params.vnp_Amount || 0);
  const responseCode = params.vnp_ResponseCode;
  const transactionStatus = params.vnp_TransactionStatus;
  const transactionNo = params.vnp_TransactionNo;

  if (!secureHash || !txnRef) {
    return jsonRsp("99", "Invalid request");
  }

  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = params;
  const computed = createVnpSecureHash(rest, hashSecret);

  if (computed.toLowerCase() !== String(secureHash).toLowerCase()) {
    return jsonRsp("97", "Invalid signature");
  }

  let conn: Awaited<ReturnType<typeof getConnection>> | null = null;
  try {
    conn = await getConnection();
    const [rows] = await conn.execute<OrderRow[]>(
      "SELECT id, total_amount, payment_status, order_status FROM orders WHERE order_number = ? LIMIT 1",
      [txnRef]
    );

    const order = rows[0];
    if (!order) {
      return jsonRsp("01", "Order not found");
    }
    const [paymentRows] = await conn.execute<PaymentRow[]>(
      "SELECT metadata FROM payments WHERE order_id = ? LIMIT 1",
      [order.id]
    );
    const existingMetadata = parseMetadata(paymentRows?.[0]?.metadata ?? null);

    if (Math.round(Number(order.total_amount) * 100) !== amount) {
      return jsonRsp("04", "Invalid amount");
    }

    if (order.payment_status === "paid") {
      return jsonRsp("02", "Order already confirmed");
    }

    const paid = responseCode === "00" && transactionStatus === "00";
    const paymentStatus = paid ? "paid" : "failed";
    const orderStatus = paid ? "paid" : "cancelled";

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
           metadata = ?
       WHERE order_id = ?`,
      [
        transactionNo || txnRef,
        paymentStatus,
        paid ? new Date() : null,
        JSON.stringify({ ...existingMetadata, ipn: rest }),
        order.id,
      ]
    );

    await conn.commit();
    return jsonRsp("00", "Confirm Success");
  } catch (error: unknown) {
    if (conn) {
      await conn.rollback().catch(() => undefined);
    }
    console.error("VNPAY IPN error:", error instanceof Error ? error.message : String(error));
    return jsonRsp("99", "Unknown error");
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}
