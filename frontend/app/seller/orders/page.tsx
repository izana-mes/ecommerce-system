"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {getUser, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";

type SellerOrder = {
  orderNumber: string;
  productId: string;
  productName: string;
  quantity: number;
  lineTotal: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
};

const ORDER_STATUSES = ["ALL", "PENDING", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUNDED"];

function StatusBadge({ status, palette }: { status: string; palette: "order" | "payment" }) {
  const s = (status || "").toUpperCase();
  let bg = "#f3f4f6", color = "#374151";
  if (palette === "order") {
    if (s === "DELIVERED" || s === "COMPLETED")    { bg = "#dcfce7"; color = "#166534"; }
    else if (s === "PROCESSING" || s === "PENDING") { bg = "#fef9c3"; color = "#854d0e"; }
    else if (s === "SHIPPED" || s === "OUT_FOR_DELIVERY") { bg = "#dbeafe"; color = "#1e40af"; }
    else if (s === "CANCELLED" || s === "REFUNDED") { bg = "#fee2e2"; color = "#991b1b"; }
  } else {
    if (s === "PAID" || s === "AUTHORIZED")          { bg = "#dcfce7"; color = "#166534"; }
    else if (s === "PENDING" || s === "PENDING_PAYMENT") { bg = "#fef9c3"; color = "#854d0e"; }
    else if (s === "REFUNDED" || s === "FAILED")     { bg = "#fee2e2"; color = "#991b1b"; }
  }
  return <span style={{ ...badgeBase, background: bg, color }}>{status.replace(/_/g, " ")}</span>;
}

export default function SellerOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const fetchOrders = useCallback(async (status?: string) => {
    if (!token) return;
    try {
      const qs = status && status !== "ALL" ? `?status=${status}` : "";
      const response = await fetch(`/api/v1/seller/orders${qs}`, {
        headers: { "Content-Type": "application/json"}});
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || data?.error || "Failed to fetch orders");
      setOrders(data?.data || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncUser = useCallback(() => {
    const currentUser = getUser();
    if (!currentUser) { router.replace("/login?returnTo=/seller/orders"); return; }
    if (currentUser.role !== "seller" && currentUser.role !== "admin") { router.replace("/profile"); return; }
    void fetchOrders(statusFilter !== "ALL" ? statusFilter : undefined);
  }, [fetchOrders, router, statusFilter]);

  useEffect(() => {
    syncUser();
    return subscribeToAuthChanges(syncUser);
  }, [syncUser]);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      o.orderNumber?.toLowerCase().includes(q) ||
      o.productName?.toLowerCase().includes(q) ||
      o.productId?.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const totalRevenue = filtered.reduce((s, o) => s + (o.lineTotal || 0), 0);
  const pendingCount = filtered.filter(o => (o.orderStatus || "").toUpperCase() === "PENDING").length;
  const deliveredCount = filtered.filter(o => ["DELIVERED", "COMPLETED"].includes((o.orderStatus || "").toUpperCase())).length;

  const exportCsv = () => {
    const header = "Order Number,Product ID,Product Name,Qty,Line Total,Order Status,Payment Status,Date";
    const rows = filtered.map(o =>
      [
        o.orderNumber,
        o.productId,
        `"${o.productName}"`,
        o.quantity,
        o.lineTotal,
        o.orderStatus,
        o.paymentStatus,
        o.createdAt ? new Date(o.createdAt).toLocaleString() : "",
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "seller-orders.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={skeletonHeaderStyle} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={skeletonCardStyle} />)}
        </div>
        <div style={skeletonTableStyle} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={titleStyle}>Orders</h1>
          <p style={subtitleStyle}>Track all orders containing your products</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={exportCsv} style={outlineButtonStyle}>⬇ Export CSV</button>
          <button type="button" onClick={() => void fetchOrders(statusFilter !== "ALL" ? statusFilter : undefined)} style={outlineButtonStyle}>↻ Refresh</button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={summaryGridStyle}>
        {[
          { label: "Total Orders", value: filtered.length, color: "#0f172a" },
          { label: "Revenue", value: `$${totalRevenue.toFixed(2)}`, color: "#6366f1" },
          { label: "Pending", value: pendingCount, color: "#f59e0b" },
          { label: "Delivered", value: deliveredCount, color: "#22c55e" },
        ].map(k => (
          <div key={k.label} style={summaryCardStyle}>
            <div style={summaryLabelStyle}>{k.label}</div>
            <div style={{ ...summaryValueStyle, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search order # or product…"
          style={searchInputStyle}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ORDER_STATUSES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                void fetchOrders(s !== "ALL" ? s : undefined);
              }}
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                border: "none",
                background: statusFilter === s ? "#0f172a" : "#f1f5f9",
                color: statusFilter === s ? "#fff" : "#475569",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap"}}
            >
              {s === "ALL" ? "All" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={tableWrapperStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Order #", "Product", "Qty", "Line Total", "Order Status", "Payment", "Date"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={emptyTdStyle}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No orders found</div>
                    <div style={{ color: "#94a3b8", fontSize: 14 }}>
                      {statusFilter !== "ALL" ? `No ${statusFilter.replace(/_/g, " ").toLowerCase()} orders` : "Orders for your products will appear here"}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((order, idx) => (
                  <tr key={`${order.orderNumber}-${idx}`} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#6366f1", fontSize: 13 }}>
                        #{order.orderNumber}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{order.productName}</div>
                      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{order.productId}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ fontWeight: 600 }}>{order.quantity}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>
                        ${(order.lineTotal || 0).toFixed(2)}
                      </span>
                    </td>
                    <td style={tdStyle}><StatusBadge status={order.orderStatus} palette="order" /></td>
                    <td style={tdStyle}><StatusBadge status={order.paymentStatus} palette="payment" /></td>
                    <td style={{ ...tdStyle, color: "#64748b", fontSize: 13 }}>
                      {order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = { padding: "36px 32px", maxWidth: 1200, margin: "0 auto" };
const pageHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 28 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" };
const subtitleStyle: CSSProperties = { margin: "6px 0 0", color: "#64748b", fontSize: 14 };
const outlineButtonStyle: CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 18px", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const summaryGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 };
const summaryCardStyle: CSSProperties = { background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", border: "1px solid #e2e8f0" };
const summaryLabelStyle: CSSProperties = { color: "#64748b", fontSize: 13, fontWeight: 500, marginBottom: 8 };
const summaryValueStyle: CSSProperties = { fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" };
const searchInputStyle: CSSProperties = { padding: "9px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, color: "#0f172a", background: "#fff", minWidth: 220 };
const tableWrapperStyle: CSSProperties = { background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)", overflow: "hidden", border: "1px solid #e2e8f0" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: CSSProperties = { background: "#f8fafc", padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
const tdStyle: CSSProperties = { padding: "14px 20px", borderBottom: "1px solid #f1f5f9", fontSize: 14, color: "#334155", verticalAlign: "middle" };
const emptyTdStyle: CSSProperties = { ...tdStyle, textAlign: "center", padding: "60px 20px", color: "#64748b" };
const badgeBase: CSSProperties = { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, textTransform: "capitalize", whiteSpace: "nowrap" };
const skeletonHeaderStyle: CSSProperties = { height: 52, background: "#e2e8f0", borderRadius: 12, marginBottom: 24 };
const skeletonCardStyle: CSSProperties = { height: 90, background: "#e2e8f0", borderRadius: 14 };
const skeletonTableStyle: CSSProperties = { height: 360, background: "#e2e8f0", borderRadius: 16 };
