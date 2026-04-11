"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useAppDispatch } from "@/store";
import { clearCart, fetchCartAsync, removeFromCartAsync } from "@/store/cartSlice";
import { getToken } from "@/lib/auth";
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

function normalizeAuthorizationHeader(token: string | null): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const normalizedToken = trimmed.replace(/^Bearer\s+/i, "");
  return `Bearer ${normalizedToken}`;
}

function VnpayReturnContent() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ReturnState>({
    loading: true,
    success: false,
    message: "Verifying payment...",
    orderNumber: "",
    order: null,
  });

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
          order: null,
        });
        return;
      }

      try {
        const response = await fetch(`/api/vnpay/return?${query}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await response.json();

        if (data?.success) {
          const authorizationHeader = normalizeAuthorizationHeader(getToken());

          if (data?.clearCart) {
            await fetch("/api/cart/clear", {
              method: "DELETE",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
              },
            }).catch(() => null);

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

        setState({
          loading: false,
          success: !!data?.success,
          message: data?.message || "Unknown payment result",
          orderNumber: data?.orderNumber || "",
          order: data?.order || null,
        });
      } catch {
        setState({
          loading: false,
          success: false,
          message: "Could not verify payment result.",
          orderNumber: "",
          order: null,
        });
      }
    };

    void verify();
  }, [dispatch, query]);

  const formatCurrency = (amount: number, currency: string) => {
    const upperCurrency = String(currency || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: upperCurrency,
      }).format(Number(amount || 0));
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
                          <th>PRODUCTS</th>
                          <th>SUBTOTALS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.productID}>
                            <td>
                              {item.productName} x {item.quantity}
                            </td>
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
