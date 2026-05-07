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

  if (loading) {
    return <div style={{ padding: "48px 16px", maxWidth: 1080, margin: "0 auto" }}>Loading orders...</div>;
  }

  return (
    <div style={{ padding: "48px 16px", background: "#f6f7fb", minHeight: "70vh" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gap: 24 }}>
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32 }}>Orders</h1>
              <p style={sectionSubtleTextStyle}>Track orders containing your products.</p>
            </div>
            <button type="button" onClick={() => void fetchOrders()} style={secondaryButtonStyle}>
              Refresh
            </button>
          </div>

          <div style={{ overflowX: "auto", marginTop: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={cellHead}>Order number</th>
                  <th style={cellHead}>Product</th>
                  <th style={cellHead}>Quantity</th>
                  <th style={cellHead}>Total</th>
                  <th style={cellHead}>Order status</th>
                  <th style={cellHead}>Payment status</th>
                  <th style={cellHead}>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={cellEmpty}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((order, idx) => (
                    <tr key={`${order.orderNumber}-${idx}`}>
                      <td style={cellBody}>
                        <strong>{order.orderNumber}</strong>
                      </td>
                      <td style={cellBody}>
                        {order.productName} <br/> <span style={mutedTextStyle}>{order.productId}</span>
                      </td>
                      <td style={cellBody}>{order.quantity}</td>
                      <td style={cellBody}>${order.lineTotal.toFixed(2)}</td>
                      <td style={cellBody}>{order.orderStatus}</td>
                      <td style={cellBody}>{order.paymentStatus}</td>
                      <td style={cellBody}>{new Date(order.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 28,
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const sectionSubtleTextStyle: CSSProperties = {
  marginTop: 8,
  marginBottom: 0,
  color: "#667085",
};

const secondaryButtonStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(16, 24, 40, 0.12)",
  borderRadius: 999,
  padding: "10px 16px",
  color: "#101828",
  fontWeight: 600,
  cursor: "pointer",
};

const cellHead: CSSProperties = {
  textAlign: "left",
  padding: "16px 14px",
  borderBottom: "1px solid rgba(16, 24, 40, 0.08)",
  color: "#667085",
  fontWeight: 600,
  fontSize: 14,
};

const cellBody: CSSProperties = {
  textAlign: "left",
  padding: "16px 14px",
  borderBottom: "1px solid rgba(16, 24, 40, 0.04)",
  color: "#101828",
  fontSize: 14,
  verticalAlign: "top",
};

const cellEmpty: CSSProperties = {
  ...cellBody,
  textAlign: "center",
  color: "#667085",
  padding: "48px 14px",
};

const mutedTextStyle: CSSProperties = {
  color: "#667085",
  fontSize: 12,
};
