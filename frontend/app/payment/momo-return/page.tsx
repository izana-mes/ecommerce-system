"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useAppDispatch } from "@/store";
import { clearCart, fetchCartAsync } from "@/store/cartSlice";
import styles from "./momo-return.module.css";

type ReturnState = {
  loading: boolean;
  success: boolean;
  message: string;
  orderNumber: string;
};

function MomoReturnContent() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const query = useMemo(() => searchParams.toString(), [searchParams]);
  const [state, setState] = useState<ReturnState>({
    loading: true,
    success: false,
    message: "Verifying payment...",
    orderNumber: "",
  });

  const orderType = searchParams.get("orderType");

  useEffect(() => {
    const verify = async () => {
      if (!query) {
        setState({
          loading: false,
          success: false,
          message: "Missing MoMo return data.",
          orderNumber: "",
        });
        return;
      }

      try {
        const response = await fetch(`/api/momo/return?${query}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await response.json();
        const success = !!data?.success;

        if (success && data?.clearCart) {
          await fetch("/api/cart/clear", {
            method: "DELETE",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          }).catch(() => null);
          dispatch(clearCart());
          await dispatch(fetchCartAsync());
        }

        setState({
          loading: false,
          success,
          message: data?.message || (success ? "Payment successful" : "Payment failed"),
          orderNumber: String(data?.orderNumber || searchParams.get("orderId") || ""),
        });
      } catch {
        setState({
          loading: false,
          success: false,
          message: "Could not verify payment result.",
          orderNumber: String(searchParams.get("orderId") || ""),
        });
      }
    };

    void verify();
  }, [dispatch, query, searchParams]);

  const currentDate = new Date();
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
                <Image
                  src="/success.png"
                  alt={state.success ? "Success" : "Failed"}
                  width={80}
                  height={80}
                />
              </div>
              <h3>
                {state.loading
                  ? "Checking payment..."
                  : state.success
                    ? "Your order is completed!"
                    : "Payment failed or cancelled"}
              </h3>
              <p>{state.message}</p>
            </div>

            {state.orderNumber && (
              <div className={styles.orderInfo}>
                <div className={styles.orderInfoItem}>
                  <p>Order Number</p>
                  <h4>{state.orderNumber}</h4>
                </div>
                <div className={styles.orderInfoItem}>
                  <p>Date</p>
                  <h4>{formatDate(currentDate)}</h4>
                </div>
                <div className={styles.orderInfoItem}>
                  <p>Payment Method</p>
                  <h4>MoMo</h4>
                </div>
                {orderType && (
                  <div className={styles.orderInfoItem}>
                    <p>Type</p>
                    <h4>{orderType}</h4>
                  </div>
                )}
              </div>
            )}

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

export default function MomoReturnPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.fallback}>
          <h1>MoMo Payment Result</h1>
          <p>Checking payment...</p>
        </div>
      }
    >
      <MomoReturnContent />
    </Suspense>
  );
}
