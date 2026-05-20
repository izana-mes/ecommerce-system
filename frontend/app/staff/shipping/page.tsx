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
  payment_method?: string | null;
  total_amount: number;
  currency: string;
  item_count: number;
  shipping_carrier?: string | null;
  shipping_tracking_public?: string | null;
  shipped_at?: string | null;
};

type ShipperIncident = {
  id: number;
  order_id: number;
  order_number: string;
  customer_email: string;
  incident_type: "DELIVERY_DELAY" | "QUALITY_COMPLAINT" | "DAMAGED_PACKAGE" | "FAILED_ATTEMPT" | "OTHER";
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "RESOLVED";
  details: string | null;
  created_at: string;
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

function isCodMethod(paymentMethod?: string | null): boolean {
  const value = String(paymentMethod || "").trim().toLowerCase();
  return value === "cod" || value.includes("cash on delivery") || (value.includes("cash") && value.includes("deliver"));
}

function canShipOrder(order: OrderRow): boolean {
  const os = normalizeStatus(order.order_status);
  const ps = normalizeStatus(order.payment_status);
  const prepaidLane = ps === "paid" && (os === "paid" || os === "processing");
  const codLane = isCodMethod(order.payment_method) && (ps === "pending" || ps === "authorized") && (os === "pending" || os === "processing");
  return prepaidLane || codLane;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"}).format(ts);
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
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"ready" | "shipped" | "attention" | "all">("ready");
  const [incidents, setIncidents] = useState<ShipperIncident[]>([]);
  const [incidentTypeById, setIncidentTypeById] = useState<Record<number, ShipperIncident["incident_type"]>>({});
  const [incidentSeverityById, setIncidentSeverityById] = useState<Record<number, ShipperIncident["severity"]>>({});
  const [incidentDetailsById, setIncidentDetailsById] = useState<Record<number, string>>({});

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
            "Content-Type": "application/json"},
          cache: "no-store"});
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
          "Content-Type": "application/json"},
        cache: "no-store"});
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

  const fetchIncidents = useCallback(async () => {
    if (!token || !allowed) return;
    try {
      const response = await fetch("/api/auth/shipper-incidents?status=OPEN", {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"});
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Could not load incidents");
      setIncidents(Array.isArray(payload) ? (payload as ShipperIncident[]) : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load incidents");
    }
  }, [allowed, token]);

  useEffect(() => {
    if (!allowed) return;
    void fetchOrders();
    void fetchIncidents();
    const t = window.setInterval(() => void fetchOrders(), 45_000);
    return () => window.clearInterval(t);
  }, [allowed, fetchIncidents, fetchOrders]);

  const markShipped = async (order: OrderRow, event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setPendingId(order.id);
    try {
      const carrier = (carrierById[order.id] ?? order.shipping_carrier ?? "").trim();
      const trackingNumber = (trackingById[order.id] ?? order.shipping_tracking_public ?? "").trim();
      if (!carrier && !trackingNumber) {
        throw new Error("Provide carrier and/or tracking number before marking shipped");
      }

      const body: Record<string, unknown> = {
        orderId: order.id,
        orderStatus: "shipped"};
      if (carrier) body.carrier = carrier;
      if (trackingNumber) body.trackingNumber = trackingNumber;

      const response = await fetch("/api/auth/admin-orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify(body)});
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

  const submitIncident = async (order: OrderRow, event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setPendingId(order.id);
    try {
      const incidentType = incidentTypeById[order.id] || "DELIVERY_DELAY";
      const severity = incidentSeverityById[order.id] || "MEDIUM";
      const details = (incidentDetailsById[order.id] || "").trim();
      if (!details) throw new Error("Please enter issue details");

      const response = await fetch("/api/auth/shipper-incidents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          orderId: order.id,
          incidentType,
          severity,
          details})});
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to submit incident");

      setIncidentDetailsById((prev) => ({ ...prev, [order.id]: "" }));
      await fetchIncidents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit incident");
    } finally {
      setPendingId(null);
    }
  };

  if (!token) {
    return null;
  }

  const filteredOrders = orders.filter((o) => {
    const ready = canShipOrder(o);
    const shipped = normalizeStatus(o.order_status) === "shipped" || normalizeStatus(o.order_status) === "completed";
    const statusMatch =
      view === "all" ? true : view === "ready" ? ready : view === "shipped" ? shipped : !ready && !shipped;
    if (!statusMatch) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      String(o.order_number).toLowerCase().includes(q) ||
      String(o.customer_email).toLowerCase().includes(q) ||
      String(o.shipping_tracking_public || "").toLowerCase().includes(q) ||
      String(o.shipping_carrier || "").toLowerCase().includes(q)
    );
  });
  const readyCount = orders.filter((o) => canShipOrder(o)).length;
  const shippedCount = orders.filter((o) => {
    const os = normalizeStatus(o.order_status);
    return os === "shipped" || os === "completed";
  }).length;
  const attentionCount = Math.max(0, orders.length - readyCount - shippedCount);
  const openIncidentCount = incidents.filter((item) => item.status === "OPEN").length;
  const incidentCountByOrder = incidents.reduce<Record<number, number>>((acc, item) => {
    acc[item.order_id] = (acc[item.order_id] || 0) + 1;
    return acc;
  }, {});

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
        Track the full fulfillment queue here, including ready-to-ship, shipped/completed, and orders that need
        attention.
      </p>
      <section className="shippingStats">
        <div className="statCard">
          <strong>{readyCount}</strong>
          <span>Ready to ship</span>
        </div>
        <div className="statCard">
          <strong>{shippedCount}</strong>
          <span>Shipped / completed</span>
        </div>
        <div className="statCard">
          <strong>{attentionCount}</strong>
          <span>Needs attention</span>
        </div>
        <div className="statCard">
          <strong>{openIncidentCount}</strong>
          <span>Open delivery incidents</span>
        </div>
      </section>
      <section className="shippingToolbar">
        <input
          type="search"
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          placeholder="Search order #, email, tracking, carrier"
          aria-label="Search shipping queue"
        />
        <div className="shippingTabs" role="tablist" aria-label="Queue view">
          {(["ready", "shipped", "attention", "all"] as const).map((tab) => (
            <button key={tab} type="button" className={view === tab ? "active" : ""} onClick={() => setView(tab)}>
              {tab}
            </button>
          ))}
        </div>
      </section>
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
            {filteredOrders.length === 0 && !loadingOrders ? (
              <tr>
                <td colSpan={5} className="muted">
                  No orders match this view.
                </td>
              </tr>
            ) : (
              filteredOrders.map((o) => {
                const os = normalizeStatus(o.order_status);
                const canShipHere = canShipOrder(o);
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
                      {incidentCountByOrder[o.id] ? (
                        <div className="incidentPill">{incidentCountByOrder[o.id]} open incident(s)</div>
                      ) : null}
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
                              Shipped: {formatDateTime(o.shipped_at)}
                            </>
                          ) : null}
                        </div>
                      )}
                      <form className="incidentForm" onSubmit={(ev) => void submitIncident(o, ev)}>
                        <select
                          value={incidentTypeById[o.id] || "DELIVERY_DELAY"}
                          onChange={(ev) =>
                            setIncidentTypeById((prev) => ({
                              ...prev,
                              [o.id]: ev.target.value as ShipperIncident["incident_type"]}))
                          }
                        >
                          <option value="DELIVERY_DELAY">Delivery delay</option>
                          <option value="QUALITY_COMPLAINT">Quality complaint</option>
                          <option value="DAMAGED_PACKAGE">Damaged package</option>
                          <option value="FAILED_ATTEMPT">Failed attempt</option>
                          <option value="OTHER">Other</option>
                        </select>
                        <select
                          value={incidentSeverityById[o.id] || "MEDIUM"}
                          onChange={(ev) =>
                            setIncidentSeverityById((prev) => ({
                              ...prev,
                              [o.id]: ev.target.value as ShipperIncident["severity"]}))
                          }
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Report delay or quality issue"
                          value={incidentDetailsById[o.id] ?? ""}
                          onChange={(ev) =>
                            setIncidentDetailsById((prev) => ({ ...prev, [o.id]: ev.target.value }))
                          }
                        />
                        <button type="submit" disabled={pendingId === o.id}>
                          {pendingId === o.id ? "Saving…" : "Report issue"}
                        </button>
                      </form>
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
