"use client";

import { CSSProperties, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser, subscribeToAuthChanges } from "@/lib/auth";
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

function OrderStatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  let bg = "#f3f4f6", color = "#374151";
  if (s === "DELIVERED" || s === "COMPLETED") { bg = "#dcfce7"; color = "#166534"; }
  else if (s === "PROCESSING" || s === "PENDING") { bg = "#fef9c3"; color = "#854d0e"; }
  else if (s === "SHIPPED" || s === "OUT_FOR_DELIVERY") { bg = "#dbeafe"; color = "#1e40af"; }
  else if (s === "CANCELLED" || s === "REFUNDED") { bg = "#fee2e2"; color = "#991b1b"; }
  return (
    <span style={{ ...badgeBase, background: bg, color }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  let bg = "#f3f4f6", color = "#374151";
  if (s === "PAID" || s === "AUTHORIZED") { bg = "#dcfce7"; color = "#166534"; }
  else if (s === "PENDING" || s === "PENDING_PAYMENT") { bg = "#fef9c3"; color = "#854d0e"; }
  else if (s === "REFUNDED" || s === "FAILED") { bg = "#fee2e2"; color = "#991b1b"; }
  return (
    <span style={{ ...badgeBase, background: bg, color }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function SellerOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<SellerOrder[]>([]);

  const fetchOrders = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/v1/seller/orders", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to fetch orders");
      }
      setOrders(data?.data || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncUser = useCallback(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/login?returnTo=/seller/orders");
      return;
    }
    if (currentUser.role !== "seller" && currentUser.role !== "admin") {
      router.replace("/profile");
      return;
    }
    void fetchOrders();
  }, [fetchOrders, router]);

  useEffect(() => {
    syncUser();
    return subscribeToAuthChanges(syncUser);
  }, [syncUser]);

  // Summary stats
  const totalRevenue = orders.reduce((sum, o) => sum + (o.lineTotal || 0), 0);
  const pendingCount = orders.filter((o) => (o.orderStatus || "").toUpperCase() === "PENDING").length;
  const deliveredCount = orders.filter(
    (o) => ["DELIVERED", "COMPLETED"].includes((o.orderStatus || "").toUpperCase())
  ).length;

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={skeletonHeaderStyle} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3].map((i) => <div key={i} style={skeletonCardStyle} />)}
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
        <button type="button" onClick={() => void fetchOrders()} style={refreshButtonStyle}>
          ↻ Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={summaryGridStyle}>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Total Orders</div>
          <div style={summaryValueStyle}>{orders.length}</div>
        </div>
        <div style={{ ...summaryCardStyle, borderTop: "3px solid #6366f1" }}>
          <div style={summaryLabelStyle}>Total Revenue</div>
          <div style={{ ...summaryValueStyle, color: "#6366f1" }}>${totalRevenue.toFixed(2)}</div>
        </div>
        <div style={{ ...summaryCardStyle, borderTop: "3px solid #f59e0b" }}>
          <div style={summaryLabelStyle}>Pending</div>
          <div style={{ ...summaryValueStyle, color: "#f59e0b" }}>{pendingCount}</div>
        </div>
        <div style={{ ...summaryCardStyle, borderTop: "3px solid #22c55e" }}>
          <div style={summaryLabelStyle}>Delivered</div>
          <div style={{ ...summaryValueStyle, color: "#22c55e" }}>{deliveredCount}</div>
        </div>
      </div>

      {/* Table */}
      <div style={tableWrapperStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Order Number</th>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>Line Total</th>
                <th style={thStyle}>Order Status</th>
                <th style={thStyle}>Payment</th>
                <th style={thStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={emptyTdStyle}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No orders yet</div>
                    <div style={{ color: "#94a3b8", fontSize: 14 }}>Orders for your products will appear here</div>
                  </td>
                </tr>
              ) : (
                orders.map((order, idx) => (
                  <tr
                    key={`${order.orderNumber}-${idx}`}
                    style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc", transition: "background 0.15s" }}
                  >
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
                    <td style={tdStyle}>
                      <OrderStatusBadge status={order.orderStatus} />
                    </td>
                    <td style={tdStyle}>
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </td>
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

const containerStyle: CSSProperties = {
  padding: "36px 32px",
  maxWidth: 1200,
  margin: "0 auto",
};

const pageHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
  gap: 16,
  marginBottom: 28,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
  letterSpacing: "-0.02em",
};

const subtitleStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const refreshButtonStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "10px 18px",
  color: "#475569",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const summaryCardStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: "20px 22px",
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
  borderTop: "3px solid #e2e8f0",
};

const summaryLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 8,
};

const summaryValueStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
  letterSpacing: "-0.02em",
};

const tableWrapperStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
  overflow: "hidden",
  border: "1px solid #e2e8f0",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: CSSProperties = {
  background: "#f8fafc",
  padding: "14px 20px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#64748b",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 14,
  color: "#334155",
  verticalAlign: "middle",
};

const emptyTdStyle: CSSProperties = {
  ...tdStyle,
  textAlign: "center",
  padding: "60px 20px",
  color: "#64748b",
};

const badgeBase: CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  textTransform: "capitalize",
  whiteSpace: "nowrap",
};

// Skeleton styles
const skeletonHeaderStyle: CSSProperties = {
  height: 52,
  background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
  borderRadius: 12,
  marginBottom: 24,
  animation: "pulse 1.5s infinite",
};

const skeletonCardStyle: CSSProperties = {
  height: 90,
  background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
  borderRadius: 14,
};

const skeletonTableStyle: CSSProperties = {
  height: 360,
  background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
  borderRadius: 16,
};
