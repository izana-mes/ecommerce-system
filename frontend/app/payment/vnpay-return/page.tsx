"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useAppDispatch } from "@/store";
import { clearCart, fetchCartAsync, removeFromCartAsync } from "@/store/cartSlice";
import { getUser } from "@/lib/auth";
import styles from "./vnpay-return.module.css";

type ReturnedOrderItem = {
  productID: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

type ReturnedOrder = {
  id: number;
  orderNumber: string;
  customerEmail: string;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerPhone?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  notes?: string | null;
  subtotal: number;
  shippingFee: number;
  vat: number;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  items: ReturnedOrderItem[];
};

type ReturnState = {
  loading: boolean;
  success: boolean;
  message: string;
  orderNumber: string;
  order: ReturnedOrder | null;
};

type HistoryOrderItem = {
  product_id?: string;
  productID?: string;
  product_name?: string;
  productName?: string;
  unit_price?: number | string;
  unitPrice?: number | string;
  quantity?: number | string;
  line_total?: number | string;
  lineTotal?: number | string;
};

type HistoryOrder = {
  id?: number | string;
  order_number?: string;
  orderNumber?: string;
  customer_email?: string;
  customerEmail?: string;
  customer_first_name?: string | null;
  customerFirstName?: string | null;
  customer_last_name?: string | null;
  customerLastName?: string | null;
  customer_phone?: string | null;
  customerPhone?: string | null;
  shipping_address_line1?: string | null;
  shippingAddressLine1?: string | null;
  shipping_address_line2?: string | null;
  shippingAddressLine2?: string | null;
  shipping_city?: string | null;
  shippingCity?: string | null;
  shipping_state?: string | null;
  shippingState?: string | null;
  shipping_postal_code?: string | null;
  shippingPostalCode?: string | null;
  shipping_country?: string | null;
  shippingCountry?: string | null;
  notes?: string | null;
  subtotal?: number | string;
  shipping_fee?: number | string;
  shippingFee?: number | string;
  vat?: number | string;
  total_amount?: number | string;
  totalAmount?: number | string;
  currency?: string;
  payment_method?: string;
  paymentMethod?: string;
  payment_status?: string;
  paymentStatus?: string;
  order_status?: string;
  orderStatus?: string;
  items?: HistoryOrderItem[];
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapHistoryOrderToReturnedOrder(order: HistoryOrder): ReturnedOrder {
  const mappedItems: ReturnedOrderItem[] = Array.isArray(order.items)
    ? order.items.map((item) => {
        const quantity = Math.max(0, Math.floor(toNumber(item.quantity)));
        const unitPrice = toNumber(item.unit_price ?? item.unitPrice);
        const lineTotalRaw = toNumber(item.line_total ?? item.lineTotal);
        return {
          productID: String(item.product_id ?? item.productID ?? ""),
          productName: String(item.product_name ?? item.productName ?? "Unknown product"),
          unitPrice,
          quantity,
          lineTotal: lineTotalRaw > 0 ? lineTotalRaw : unitPrice * quantity};
      })
    : [];

  return {
    id: toNumber(order.id),
    orderNumber: String(order.order_number ?? order.orderNumber ?? ""),
    customerEmail: String(order.customer_email ?? order.customerEmail ?? ""),
    customerFirstName: (order.customer_first_name ?? order.customerFirstName ?? null) as string | null,
    customerLastName: (order.customer_last_name ?? order.customerLastName ?? null) as string | null,
    customerPhone: (order.customer_phone ?? order.customerPhone ?? null) as string | null,
    shippingAddressLine1: (order.shipping_address_line1 ?? order.shippingAddressLine1 ?? null) as string | null,
    shippingAddressLine2: (order.shipping_address_line2 ?? order.shippingAddressLine2 ?? null) as string | null,
    shippingCity: (order.shipping_city ?? order.shippingCity ?? null) as string | null,
    shippingState: (order.shipping_state ?? order.shippingState ?? null) as string | null,
    shippingPostalCode: (order.shipping_postal_code ?? order.shippingPostalCode ?? null) as string | null,
    shippingCountry: (order.shipping_country ?? order.shippingCountry ?? null) as string | null,
    notes: (order.notes ?? null) as string | null,
    subtotal: toNumber(order.subtotal),
    shippingFee: toNumber(order.shipping_fee ?? order.shippingFee),
    vat: toNumber(order.vat),
    totalAmount: toNumber(order.total_amount ?? order.totalAmount),
    currency: String(order.currency ?? "USD"),
    paymentMethod: String(order.payment_method ?? order.paymentMethod ?? ""),
    paymentStatus: String(order.payment_status ?? order.paymentStatus ?? ""),
    orderStatus: String(order.order_status ?? order.orderStatus ?? ""),
    items: mappedItems};
}

async function fetchOrderFromHistory(orderNumber: string, token: string | null): Promise<ReturnedOrder | null> {
  if (!orderNumber) return null;
  try {
    const response = await fetch("/api/orders/history?page=0&size=50", {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"}});
    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    const orders = Array.isArray(payload?.content) ? (payload.content as HistoryOrder[]) : [];
    const matched = orders.find((o) => String(o.order_number ?? o.orderNumber ?? "").toUpperCase() === orderNumber.toUpperCase());
    return matched ? mapHistoryOrderToReturnedOrder(matched) : null;
  } catch {
    return null;
  }
}

function VnpayReturnContent() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ReturnState>({
    loading: true,
    success: false,
    message: "Verifying payment...",
    orderNumber: "",
    order: null});

  const query = useMemo(() => searchParams.toString(), [searchParams]);
  const currentDate = new Date();

  useEffect(() => {
    const verify = async () => {
      if (!query) {
        setState({
          loading: false,
          success: false,
          message: "Missing VNPAY return data.",
          orderNumber: "",
          order: null});
        return;
      }

      try {
        const response = await fetch(`/api/vnpay/return?${query}`, {
          method: "GET",
          credentials: "include"});
        const data = await response.json();

        if (data?.success) {
          if (data?.clearCart) {
            await fetch("/api/cart/clear", {
              method: "DELETE",
              credentials: "include",
              headers: {
                "Content-Type": "application/json"}}).catch(() => null);

            dispatch(clearCart());
          }

          if (Array.isArray(data?.removedProductIDs) && data.removedProductIDs.length > 0) {
            await Promise.allSettled(
              data.removedProductIDs.map((productID: unknown) =>
                dispatch(removeFromCartAsync(String(productID))).unwrap()
              )
            );
          }

          const boughtProductIdsFromOrder = Array.isArray(data?.order?.items)
            ? Array.from(
                new Set(
                  data.order.items
                    .map((item: { productID?: unknown }) => String(item?.productID || "").trim())
                    .filter(Boolean)
                )
              )
            : [];

          if (!data?.clearCart && boughtProductIdsFromOrder.length > 0) {
            await Promise.allSettled(
              boughtProductIdsFromOrder.map((productID) =>
                dispatch(removeFromCartAsync(String(productID))).unwrap()
              )
            );
          }

          await dispatch(fetchCartAsync());
        }

        let resolvedOrder = (data?.order as ReturnedOrder | null) ?? null;
        const resolvedOrderNumber = String(data?.orderNumber || data?.order?.orderNumber || "");

        if (data?.success && (!resolvedOrder || !Array.isArray(resolvedOrder.items) || resolvedOrder.items.length === 0)) {          const fallbackOrder = await fetchOrderFromHistory(resolvedOrderNumber, null);
          if (fallbackOrder) {
            resolvedOrder = fallbackOrder;
          }
        }

        setState({
          loading: false,
          success: !!data?.success,
          message: data?.message || "Unknown payment result",
          orderNumber: resolvedOrderNumber,
          order: resolvedOrder});
      } catch {
        setState({
          loading: false,
          success: false,
          message: "Could not verify payment result.",
          orderNumber: "",
          order: null});
      }
    };

    void verify();
  }, [dispatch, query]);

  const formatCurrency = (amount: number, currency: string) => {
    const upperCurrency = String(currency || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: upperCurrency}).format(Number(amount || 0));
    } catch {
      return `${upperCurrency} ${Number(amount || 0).toFixed(2)}`;
    }
  };

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className={styles.returnPage}>
      <section className={styles.section}>
        <h2>CART</h2>

        <div className={`${styles.tabs} ${styles.tab3}`}>
          <button type="button">
            <div className={styles.tabNumber}>
              <h3>01</h3>
              <p>SHOPPING BAG</p>
            </div>
          </button>
          <button type="button">
            <div className={styles.tabNumber}>
              <h3>02</h3>
              <p>SHIPPING AND CHECKOUT</p>
            </div>
          </button>
          <button type="button" className={styles.active}>
            <div className={styles.tabNumber}>
              <h3>03</h3>
              <p>CONFIRMATION</p>
            </div>
          </button>
        </div>

        <div className={styles.orderCompleteSection}>
          <div className={styles.orderComplete}>
            <div className={styles.orderCompleteMessage}>
              <div className={styles.orderCompleteMessageImg}>
                <Image src="/success.png" alt="Success" width={80} height={80} />
              </div>
              <h3>{state.loading ? "Checking payment..." : state.success ? "Your order is completed!" : "Payment failed"}</h3>
              <p>{state.message}</p>
            </div>

            {state.order ? (
              (() => {
                const order = state.order;
                return (
              <>
                <div className={styles.orderInfo}>
                  <div className={styles.orderInfoItem}>
                    <p>Order Number</p>
                    <h4>{order.orderNumber}</h4>
                  </div>
                  <div className={styles.orderInfoItem}>
                    <p>Date</p>
                    <h4>{formatDate(currentDate)}</h4>
                  </div>
                  <div className={styles.orderInfoItem}>
                    <p>Total</p>
                    <h4>{formatCurrency(order.totalAmount, order.currency)}</h4>
                  </div>
                  <div className={styles.orderInfoItem}>
                    <p>Payment Method</p>
                    <h4>{order.paymentMethod || "-"}</h4>
                  </div>
                </div>

                <div className={styles.orderTotalContainer}>
                  <h3>Order Details</h3>
                  <div className={styles.orderItems}>
                    <table>
                      <thead>
                        <tr>
                          <th>PRODUCT</th>
                          <th>QTY</th>
                          <th>UNIT PRICE</th>
                          <th>LINE TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={`${item.productID}-${item.productName}`}>
                            <td>{item.productName}</td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.unitPrice, order.currency)}</td>
                            <td>{formatCurrency(item.lineTotal, order.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.orderTotal}>
                    <table>
                      <tbody>
                        <tr>
                          <th>Subtotal</th>
                          <td>{formatCurrency(order.subtotal, order.currency)}</td>
                        </tr>
                        <tr>
                          <th>Shipping</th>
                          <td>{formatCurrency(order.shippingFee, order.currency)}</td>
                        </tr>
                        <tr>
                          <th>VAT</th>
                          <td>{formatCurrency(order.vat, order.currency)}</td>
                        </tr>
                        <tr>
                          <th>Total</th>
                          <td>{formatCurrency(order.totalAmount, order.currency)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
                );
              })()
            ) : state.orderNumber ? (
              <div className={styles.orderInfoFallback}>Order Number: {state.orderNumber}</div>
            ) : null}

            <div className={styles.actionRow}>
              <Link href="/cart">Back to Cart</Link>
              <Link href="/">Back to Home</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function VnpayReturnPage() {
  const token = getUser();
  return (
    <Suspense
      fallback={
        <div className={styles.fallback}>
          <h1>VNPAY Payment Result</h1>
          <p>Checking payment...</p>
        </div>
      }
    >
      <VnpayReturnContent />
    </Suspense>
  );
}
