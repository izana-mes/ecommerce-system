"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";
import "./shipping.css";

type OrderRow = {
  id: number;
  order_number: string;
  customer_email: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  currency: string;
  item_count: number;
  shipping_carrier?: string | null;
  shipping_tracking_public?: string | null;
  shipped_at?: string | null;
};

function canAccessShipping(profile: { role?: string; roles?: string[] } | null): boolean {
  const r = String(profile?.role || "").toLowerCase();
  const roles = Array.isArray(profile?.roles) ? profile.roles.map((x) => String(x).toUpperCase()) : [];
  return (
    r === "shipper" ||
    r === "admin" ||
    r === "employee" ||
    roles.includes("ROLE_SHIPPER") ||
    roles.includes("ROLE_ADMIN") ||
    roles.includes("ROLE_EMPLOYEE")
  );
}

function normalizeStatus(s: string): string {
  return String(s || "").trim().toLowerCase();
}

export default function StaffShippingPage() {
  const router = useRouter();
  const token = getToken();
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const [carrierById, setCarrierById] = useState<Record<number, string>>({});
  const [trackingById, setTrackingById] = useState<Record<number, string>>({});

  useEffect(() => {
    const run = async () => {
      const user = getUser();
      if (!user || !token) {
        router.replace("/login");
        return;
      }
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setAllowed(false);
          return;
        }
        setAllowed(canAccessShipping(data?.data));
      } catch {
        setAllowed(false);
      } finally {
        setLoadingAccess(false);
      }
    };
    void run();
  }, [router, token]);

  const fetchOrders = useCallback(async () => {
    if (!token || !allowed) return;
    setLoadingOrders(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/admin-orders?page=1&size=100", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Could not load orders");
      }
      const rows = Array.isArray(payload?.content) ? payload.content : [];
      setOrders(rows as OrderRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load orders");
    } finally {
      setLoadingOrders(false);
    }
  }, [allowed, token]);

  useEffect(() => {
    if (!allowed) return;
    void fetchOrders();
    const t = window.setInterval(() => void fetchOrders(), 45_000);
    return () => window.clearInterval(t);
  }, [allowed, fetchOrders]);

  const markShipped = async (order: OrderRow, event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setPendingId(order.id);
    try {
      const carrier = (carrierById[order.id] ?? order.shipping_carrier ?? "").trim();
      const trackingNumber = (trackingById[order.id] ?? order.shipping_tracking_public ?? "").trim();

      const body: Record<string, unknown> = {
        orderId: order.id,
        orderStatus: "shipped",
      };
      if (carrier) body.carrier = carrier;
      if (trackingNumber) body.trackingNumber = trackingNumber;

      const response = await fetch("/api/auth/admin-orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Update failed");
      }
      await fetchOrders();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPendingId(null);
    }
  };

  if (!token) {
    return null;
  }

  if (loadingAccess) {
    return (
      <main className="shippingPage">
        <p className="muted">Checking access…</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="shippingPage">
        <h1>Shipping queue</h1>
        <p className="muted">You do not have permission to view this page.</p>
      </main>
    );
  }

  return (
    <main className="shippingPage">
      <h1>Fulfillment queue</h1>
      <p className="shippingIntro">
        Prepaid orders (payment confirmed) and Cash on Delivery orders awaiting dispatch appear in the queue. Pure
        shippers see that scoped slice only; admins and employees see full order history in this view.
      </p>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loadingOrders ? <p className="muted">Loading orders…</p> : null}

      <div className="shippingTableWrap">
        <table className="shippingTable">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Total</th>
              <th>Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && !loadingOrders ? (
              <tr>
                <td colSpan={5} className="muted">
                  No orders in this view.
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const os = normalizeStatus(o.order_status);
                const ps = normalizeStatus(o.payment_status);
                const paidOk = ps === "paid";
                const canShipHere = paidOk && (os === "paid" || os === "processing");
                const isShipped = os === "shipped" || os === "completed";
                return (
                  <tr key={o.id}>
                    <td>
                      <div>
                        <strong>{o.order_number}</strong>
                      </div>
                      <div className="muted">{o.item_count} items</div>
                    </td>
                    <td>{o.customer_email}</td>
                    <td>
                      <span className={`badge ${canShipHere ? "badgeReady" : isShipped ? "badgeShipped" : ""}`}>
                        {o.order_status} / {o.payment_status}
                      </span>
                    </td>
                    <td>
                      {o.currency} {Number(o.total_amount).toFixed(2)}
                    </td>
                    <td>
                      {canShipHere ? (
                        <form className="shipForm" onSubmit={(ev) => void markShipped(o, ev)}>
                          <input
                            type="text"
                            placeholder="Carrier (optional)"
                            value={carrierById[o.id] ?? o.shipping_carrier ?? ""}
                            onChange={(ev) =>
                              setCarrierById((prev) => ({ ...prev, [o.id]: ev.target.value }))
                            }
                          />
                          <input
                            type="text"
                            placeholder="Public tracking # (optional)"
                            value={trackingById[o.id] ?? o.shipping_tracking_public ?? ""}
                            onChange={(ev) =>
                              setTrackingById((prev) => ({ ...prev, [o.id]: ev.target.value }))
                            }
                          />
                          <button type="submit" disabled={pendingId === o.id}>
                            {pendingId === o.id ? "Saving…" : "Mark shipped"}
                          </button>
                        </form>
                      ) : (
                        <div className="muted">
                          {o.shipping_carrier || "—"}
                          {o.shipping_tracking_public ? (
                            <>
                              <br />
                              Tracking: {o.shipping_tracking_public}
                            </>
                          ) : null}
                          {o.shipped_at ? (
                            <>
                              <br />
                              Shipped: {o.shipped_at}
                            </>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
