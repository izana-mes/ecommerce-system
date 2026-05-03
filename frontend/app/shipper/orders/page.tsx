"use client";

import { useCallback, useEffect, useState } from "react";
import { MdRefresh, MdCheckCircle, MdWarning, MdCancel, MdSearch } from "react-icons/md";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";

interface OrderItem {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  expectedDeliveryAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  shipperUserId: string | null;
}

interface AssignedOrderItem {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  shipperUserId: string | null;
  expectedDeliveryAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  processing: "sh-badge-blue",
  completed: "sh-badge-green",
  cancelled: "sh-badge-red",
  pending: "sh-badge-amber",
  pending_payment: "sh-badge-amber",
};

export default function ShipperOrdersPage() {
  const [assignedOrders, setAssignedOrders] = useState<AssignedOrderItem[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [orderIdSearch, setOrderIdSearch] = useState("");
  const [order, setOrder] = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState(false);

  // Status update form
  const [statusValue, setStatusValue] = useState("PICKED_UP");
  const [note, setNote] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchOrder = useCallback(async (id: string) => {
    const token = getToken();
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/shipper/orders/${id}/tracking`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Order not found");
      setOrder(data.data ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssignedOrders = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoadingAssigned(true);
    try {
      const res = await fetch(`/api/v1/shipper/orders?activeOnly=true&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load assigned orders");
      setAssignedOrders(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setAssignedOrders([]);
    } finally {
      setLoadingAssigned(false);
    }
  }, []);

  const updateStatus = async () => {
    const token = getToken();
    if (!token || !order) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { status: statusValue, note };
      if (statusValue === "PICKED_UP" && expectedDeliveryAt)
        body.expectedDeliveryAt = expectedDeliveryAt;
      if (statusValue === "FAILED" && failureReason)
        body.failureReason = failureReason;

      const res = await fetch(`/api/v1/shipper/orders/${order.orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update status");
      toast.success(`✅ Status updated to ${statusValue}`);
      await fetchOrder(String(order.orderId));
      await fetchAssignedOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const statusIcon = (s: string) => {
    if (s === "completed") return <MdCheckCircle style={{ color: "#34d399" }} />;
    if (s === "cancelled") return <MdCancel style={{ color: "#f87171" }} />;
    return <MdWarning style={{ color: "#fcd34d" }} />;
  };

  useEffect(() => {
    void fetchAssignedOrders();
  }, [fetchAssignedOrders]);

  return (
    <>
      <div className="sh-topbar">
        <div className="sh-topbar-title">
          <h1>Order Management</h1>
          <p>Look up orders and update delivery status</p>
        </div>
      </div>

      <div className="sh-content">
        <div className="sh-section-gap">

          {/* ── Assigned orders ── */}
          <div className="sh-card">
            <div className="sh-card-header">
              <div>
                <h2 className="sh-card-title">My Assigned Orders</h2>
                <p className="sh-card-subtitle">Orders assigned to you by admin/staff</p>
              </div>
              <button
                className="sh-btn sh-btn-secondary"
                onClick={() => void fetchAssignedOrders()}
                disabled={loadingAssigned}
                title="Refresh"
              >
                <MdRefresh />
              </button>
            </div>

            {loadingAssigned ? (
              <div style={{ padding: "10px 0", color: "#64748b", fontSize: 13 }}>Loading…</div>
            ) : assignedOrders.length === 0 ? (
              <div style={{ padding: "10px 0", color: "#64748b", fontSize: 13 }}>
                No orders assigned to you yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {assignedOrders.map((o) => (
                  <button
                    key={o.orderId}
                    className="sh-btn sh-btn-secondary"
                    style={{
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 12,
                      textAlign: "left",
                    }}
                    onClick={() => {
                      setOrderIdSearch(String(o.orderId));
                      void fetchOrder(String(o.orderId));
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontWeight: 700, color: "#f1f5f9" }}>
                        {o.orderNumber} <span style={{ color: "#64748b", fontWeight: 600 }}>#{o.orderId}</span>
                      </span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        Expected: {fmt(o.expectedDeliveryAt)}
                      </span>
                    </span>
                    <span className={`sh-badge ${STATUS_BADGE[o.orderStatus] ?? "sh-badge-gray"}`}>
                      {o.orderStatus}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Search ── */}
          <div className="sh-card">
            <div className="sh-card-header">
              <div>
                <h2 className="sh-card-title">Find Order</h2>
                <p className="sh-card-subtitle">Enter the order ID to load tracking info</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                className="sh-input"
                placeholder="Order ID (e.g. 42)"
                value={orderIdSearch}
                onChange={(e) => setOrderIdSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void fetchOrder(orderIdSearch)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button
                className="sh-btn sh-btn-primary"
                onClick={() => void fetchOrder(orderIdSearch)}
                disabled={loading || !orderIdSearch}
              >
                <MdSearch /> {loading ? "Searching…" : "Load Order"}
              </button>
              {order && (
                <button
                  className="sh-btn sh-btn-secondary"
                  onClick={() => void fetchOrder(String(order.orderId))}
                  disabled={loading}
                >
                  <MdRefresh />
                </button>
              )}
            </div>
          </div>

          {order && (
            <div className="sh-row" style={{ alignItems: "flex-start" }}>

              {/* ── Order info ── */}
              <div className="sh-card" style={{ flex: "1 1 340px" }}>
                <div className="sh-card-header">
                  <div>
                    <h2 className="sh-card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {statusIcon(order.orderStatus)}
                      {order.orderNumber}
                    </h2>
                    <p className="sh-card-subtitle">Order #{order.orderId}</p>
                  </div>
                  <span className={`sh-badge ${STATUS_BADGE[order.orderStatus] ?? "sh-badge-gray"}`}>
                    {order.orderStatus}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { label: "Order #", value: order.orderNumber },
                    { label: "Status", value: order.orderStatus },
                    { label: "Picked Up At", value: fmt(order.pickedUpAt) },
                    { label: "Expected By", value: fmt(order.expectedDeliveryAt) },
                    { label: "Delivered At", value: fmt(order.deliveredAt) },
                    { label: "Failed At", value: fmt(order.failedAt) },
                    { label: "Failure Reason", value: order.failureReason ?? "—" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "11px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 13, color: "#64748b", flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", textAlign: "right" }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* SLA indicator */}
                {order.expectedDeliveryAt && !order.deliveredAt && !order.failedAt && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background:
                        new Date(order.expectedDeliveryAt) > new Date()
                          ? "rgba(16,185,129,0.08)"
                          : "rgba(239,68,68,0.08)",
                      border: `1px solid ${
                        new Date(order.expectedDeliveryAt) > new Date()
                          ? "rgba(16,185,129,0.2)"
                          : "rgba(239,68,68,0.2)"
                      }`,
                      fontSize: 13,
                      color: "#f1f5f9",
                    }}
                  >
                    {new Date(order.expectedDeliveryAt) > new Date()
                      ? `✅ On time — due ${fmt(order.expectedDeliveryAt)}`
                      : `⚠️ LATE — was due ${fmt(order.expectedDeliveryAt)}`}
                  </div>
                )}
              </div>

              {/* ── Status update ── */}
              <div className="sh-card" style={{ flex: "1 1 340px" }}>
                <div className="sh-card-header">
                  <div>
                    <h2 className="sh-card-title">Update Delivery Status</h2>
                    <p className="sh-card-subtitle">Mark the delivery outcome for this order</p>
                  </div>
                </div>

                <div className="sh-section-gap">
                  <div className="sh-form-group">
                    <label className="sh-label">New Status *</label>
                    <select
                      className="sh-select"
                      value={statusValue}
                      onChange={(e) => setStatusValue(e.target.value)}
                    >
                      <option value="PICKED_UP">📦 Picked Up</option>
                      <option value="DELIVERED">✅ Delivered</option>
                      <option value="FAILED">❌ Failed</option>
                    </select>
                  </div>

                  {statusValue === "PICKED_UP" && (
                    <div className="sh-form-group">
                      <label className="sh-label">Expected Delivery At</label>
                      <input
                        type="datetime-local"
                        className="sh-input"
                        value={expectedDeliveryAt}
                        onChange={(e) => setExpectedDeliveryAt(e.target.value)}
                      />
                    </div>
                  )}

                  {statusValue === "FAILED" && (
                    <div className="sh-form-group">
                      <label className="sh-label">Failure Reason</label>
                      <input
                        className="sh-input"
                        placeholder="e.g. Customer not available after 3 attempts"
                        value={failureReason}
                        onChange={(e) => setFailureReason(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="sh-form-group">
                    <label className="sh-label">Internal Note</label>
                    <textarea
                      className="sh-textarea"
                      placeholder="Optional note for admin records…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      style={{ minHeight: 70 }}
                    />
                  </div>

                  <button
                    className={`sh-btn ${statusValue === "DELIVERED" ? "sh-btn-success" : statusValue === "FAILED" ? "sh-btn-danger" : "sh-btn-primary"}`}
                    onClick={() => void updateStatus()}
                    disabled={submitting}
                    style={{ width: "100%", ...(statusValue === "FAILED" ? { background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff" } : {}) }}
                  >
                    {submitting
                      ? "Updating…"
                      : statusValue === "DELIVERED"
                      ? "✅ Confirm Delivered"
                      : statusValue === "FAILED"
                      ? "❌ Mark as Failed"
                      : "📦 Mark as Picked Up"}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* Empty state */}
          {!order && !loading && (
            <div
              className="sh-card"
              style={{ textAlign: "center", padding: "48px 16px", color: "#475569" }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
              <p>Search for an order above to load its tracking info and update the delivery status.</p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
