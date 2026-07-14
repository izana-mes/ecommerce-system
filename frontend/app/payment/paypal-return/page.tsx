"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./paypal-return.module.css";

type ReturnState =
  | { status: "loading" }
  | { status: "success"; orderNumber: string; captureId: string }
  | { status: "cancelled"; orderNumber: string }
  | { status: "error"; message: string };

/**
 * PayPal return page — handles both success and cancel redirects.
 *
 * NOTE: This page is used only when PayPal redirects back (redirect flow).
 * When using the JS SDK popup (recommended), onApprove fires directly
 * inside PayPalCheckoutButton — this page won't be needed.
 *
 * Query params set by PayPal on redirect:
 *   - token          → PayPal order ID
 *   - PayerID        → set on approval; absent on cancel
 *   - orderNumber    → set by us in the return URL
 */
function PayPalReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialState = useMemo<ReturnState>(() => {
    const paypalOrderId = searchParams.get("token");
    const payerId = searchParams.get("PayerID");
    const orderNumber = searchParams.get("orderNumber") ?? "";

    if (!payerId || !paypalOrderId) {
      return { status: "cancelled", orderNumber };
    }

    if (!orderNumber) {
      return { status: "error", message: "Missing order reference. Please contact support." };
    }

    return { status: "loading" };
  }, [searchParams]);
  const [state, setState] = useState<ReturnState>(initialState);

  useEffect(() => {
    if (state.status !== "loading") {
      return;
    }

    const paypalOrderId = searchParams.get("token");
    const orderNumber = searchParams.get("orderNumber") ?? "";

    if (!paypalOrderId || !orderNumber) {
      return;
    }

    // Capture the payment via BFF → Spring Boot server-side
    (async () => {
      try {
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paypalOrderId, orderNumber }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          setState({
            status: "success",
            orderNumber,
            captureId: data.captureId ?? paypalOrderId,
          });
          // Redirect to orders page after 3 s
          setTimeout(() => router.push("/orders"), 3000);
        } else {
          // If capture endpoint returned an error but payment actually completed
          // (e.g., webhook or delayed processing), check order status before showing an error.
          try {
            const check = await fetch(`/api/orders/number/${encodeURIComponent(orderNumber)}/track`, {
              method: "GET",
              credentials: "include",
            });
            if (check.ok) {
              const payload = await check.json().catch(() => null);
              const d = payload?.data ?? payload;
              const paymentStatus = (d?.paymentStatus || d?.payment_status || "").toLowerCase();
              if (paymentStatus === "paid") {
                setState({ status: "success", orderNumber, captureId: d?.payment_reference ?? paypalOrderId });
                setTimeout(() => router.push("/orders"), 3000);
                return;
              }
            }
          } catch (e) {
            // ignore
          }

          setState({
            status: "error",
            message: data.message ?? "Payment could not be confirmed. Please contact support.",
          });
        }
      } catch {
        setState({
          status: "error",
          message: "Failed to confirm payment. Please check your order status.",
        });
      }
    })();
  }, [searchParams, router, state.status]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {state.status === "loading" && (
          <>
            <div className={styles.spinner} />
            <h1 className={styles.title}>Confirming your payment…</h1>
            <p className={styles.subtitle}>Please wait while we verify with PayPal.</p>
          </>
        )}

        {state.status === "success" && (
          <>
            <div className={styles.iconSuccess}>✓</div>
            <h1 className={styles.title}>Payment Successful!</h1>
            <p className={styles.subtitle}>
              Your order <strong>{state.orderNumber}</strong> has been confirmed.
            </p>
            <p className={styles.meta}>Capture ID: {state.captureId}</p>
            <p className={styles.redirect}>Redirecting to your orders…</p>
            <Link href="/orders" className={styles.btn}>
              View Orders
            </Link>
          </>
        )}

        {state.status === "cancelled" && (
          <>
            <div className={styles.iconCancelled}>✕</div>
            <h1 className={styles.title}>Payment Cancelled</h1>
            <p className={styles.subtitle}>
              You cancelled the PayPal payment. Your order is still pending.
            </p>
            <div className={styles.actions}>
              <button
                className={styles.btn}
                onClick={() => router.back()}
              >
                Go Back
              </button>
              <Link href="/orders" className={`${styles.btn} ${styles.btnSecondary}`}>
                View Orders
              </Link>
            </div>
          </>
        )}

        {state.status === "error" && (
          <>
            <div className={styles.iconError}>!</div>
            <h1 className={styles.title}>Payment Error</h1>
            <p className={styles.subtitle}>{state.message}</p>
            <div className={styles.actions}>
              <Link href="/orders" className={styles.btn}>
                View My Orders
              </Link>
              <Link href="/cart" className={`${styles.btn} ${styles.btnSecondary}`}>
                Return to Cart
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PayPalReturnPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.card}>
            <div className={styles.spinner} />
            <h1 className={styles.title}>Loading…</h1>
          </div>
        </div>
      }
    >
      <PayPalReturnContent />
    </Suspense>
  );
}
