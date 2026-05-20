"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useAppDispatch } from "@/store";
import { clearCart, fetchCartAsync } from "@/store/cartSlice";
import {}  from "@/lib/auth";
import { useEffect } from "react";
import styles from "./momo-return.module.css";

function MomoReturnContent() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();

  const resultCode = searchParams.get("resultCode");
  const message = searchParams.get("message");
  const orderId = searchParams.get("orderId");
  const orderType = searchParams.get("orderType");

  const isSuccess = resultCode === "0";

  useEffect(() => {
    if (isSuccess) {
      // Clear the cart on successful payment
      fetch("/api/cart/clear", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"}})
        .catch(() => null)
        .then(() => {
          dispatch(clearCart());
        })
        .catch(() => null);

      dispatch(fetchCartAsync());
    }
  }, [isSuccess, dispatch]);

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
                  alt={isSuccess ? "Success" : "Failed"}
                  width={80}
                  height={80}
                />
              </div>
              <h3>{isSuccess ? "Your order is completed!" : "Payment failed or cancelled"}</h3>
              <p>
                {isSuccess
                  ? "Thank you! Your MoMo payment was processed successfully."
                  : (message || "The MoMo transaction was not completed.")}
              </p>
            </div>

            {orderId && (
              <div className={styles.orderInfo}>
                <div className={styles.orderInfoItem}>
                  <p>Order Number</p>
                  <h4>{orderId}</h4>
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
