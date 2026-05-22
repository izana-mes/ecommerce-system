"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PayPalCheckoutButton.module.css";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any;
  }
}

interface PayPalCheckoutButtonProps {
  /** Internal order number — must exist in DB with status "pending" before rendering this button. */
  orderNumber: string;
  /** Order total for display only — actual amount is validated on the backend. */
  amount: number;
  currency?: string;
  onSuccess: (captureId: string, paymentStatus: string) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
}

type ButtonState = "idle" | "loading" | "ready" | "processing" | "success" | "error";

/**
 * PayPal Checkout Button — renders the official PayPal JS SDK button.
 *
 * Flow:
 *  1. Component mounts → dynamically loads PayPal JS SDK
 *  2. SDK ready → renders PayPal smart button
 *  3. User clicks button → createOrder() calls BFF → backend creates PayPal order
 *  4. User approves on PayPal → onApprove() calls BFF → backend captures & verifies
 *  5. Success callback with captureId and paymentStatus
 *
 * Security:
 * - Only NEXT_PUBLIC_PAYPAL_CLIENT_ID is exposed to the browser (public key, safe)
 * - Amount verification happens on the backend — this component cannot be tampered with to bypass payment
 * - We call our BFF routes, never PayPal APIs directly
 */
export default function PayPalCheckoutButton({
  orderNumber,
  amount,
  currency = "USD",
  onSuccess,
  onCancel,
  onError,
}: PayPalCheckoutButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ButtonState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const rendered = useRef(false);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      setErrorMessage("PayPal is not configured. Please contact support.");
      setState("error");
      return;
    }

    // Avoid double-rendering in StrictMode
    if (rendered.current) return;

    const scriptId = "paypal-sdk-script";

    const renderButton = () => {
      if (!window.paypal || !containerRef.current || rendered.current) return;
      rendered.current = true;
      setState("ready");

      window.paypal
        .Buttons({
          style: {
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "paypal",
            height: 48,
          },

          /**
           * Step 1: Create a PayPal order via our BFF.
           * The BFF calls Spring Boot which reads the amount from DB.
           */
          createOrder: async () => {
            try {
              const res = await fetch(
                `/api/paypal/create-order?orderNumber=${encodeURIComponent(orderNumber)}`,
                { method: "POST", credentials: "include" }
              );
              const data = await res.json();
              if (!res.ok || !data.paypalOrderId) {
                throw new Error(data.message ?? "Failed to create PayPal order");
              }
              return data.paypalOrderId;
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Order creation failed";
              setErrorMessage(msg);
              setState("error");
              onError?.(msg);
              throw err; // Re-throw so PayPal SDK shows its error UI
            }
          },

          /**
           * Step 2: User approved on PayPal → capture server-side via BFF.
           * We pass paypalOrderId + orderNumber; backend verifies amount and captures.
           */
          onApprove: async (data: { orderID: string }) => {
            setState("processing");
            try {
              const res = await fetch("/api/paypal/capture-order", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paypalOrderId: data.orderID,
                  orderNumber,
                }),
              });
              const result = await res.json();

              if (!res.ok || !result.success) {
                throw new Error(result.message ?? "Payment capture failed");
              }

              setState("success");
              onSuccess(result.captureId ?? data.orderID, result.paymentStatus ?? "paid");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Capture failed";
              setErrorMessage(msg);
              setState("error");
              onError?.(msg);
            }
          },

          /** User clicked Cancel in the PayPal popup. */
          onCancel: () => {
            setState("idle");
            onCancel?.();
          },

          /** PayPal SDK-level error (network, config, etc.). */
          onError: (err: unknown) => {
            const msg =
              err instanceof Error ? err.message : "PayPal encountered an error";
            console.error("[PayPal SDK] onError:", err);
            setErrorMessage(msg);
            setState("error");
            onError?.(msg);
          },
        })
        .render(containerRef.current);
    };

    // If script already loaded (e.g., hot reload), render immediately
    if (document.getElementById(scriptId) && window.paypal) {
      renderButton();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&intent=capture`;
    script.async = true;
    script.onload = renderButton;
    script.onerror = () => {
      setErrorMessage("Failed to load PayPal SDK. Check your internet connection.");
      setState("error");
    };
    document.body.appendChild(script);

    return () => {
      // Clean up only the button, not the script tag (reuse across renders)
      rendered.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, orderNumber, currency]);

  return (
    <div className={styles.wrapper}>
      {/* Loading skeleton */}
      {state === "loading" && (
        <div className={styles.skeleton} aria-label="Loading PayPal…" />
      )}

      {/* Processing overlay */}
      {state === "processing" && (
        <div className={styles.processing}>
          <span className={styles.spinner} />
          <p>Processing your payment…</p>
        </div>
      )}

      {/* Success state */}
      {state === "success" && (
        <div className={styles.successBanner}>
          <span className={styles.checkIcon}>✓</span>
          Payment confirmed!
        </div>
      )}

      {/* Error state */}
      {state === "error" && (
        <div className={styles.errorBanner} role="alert">
          <strong>Payment failed:</strong> {errorMessage}
          <button
            className={styles.retryBtn}
            onClick={() => {
              setErrorMessage("");
              setState("idle");
              rendered.current = false;
              window.location.reload(); // simplest safe retry
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* PayPal button mount point — always in DOM so SDK can render into it */}
      <div
        ref={containerRef}
        className={styles.paypalContainer}
        style={{
          display: state === "loading" || state === "processing" || state === "success" || state === "error"
            ? "none"
            : "block",
        }}
        aria-label="PayPal payment button"
      />
    </div>
  );
}
