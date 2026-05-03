"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";
import { CSSProperties } from "react";

type RevenuePoint = { day: string; orders: number; revenue: number };
type TopProduct = { productId: string; productName: string; soldQty: number; revenue: number };

type DashboardData = {
  totalRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalProducts: number;
  lowStockCount: number;
  availableBalance: number;
  pendingBalance: number;
  revenueByDay: RevenuePoint[];
  topSellingProducts: TopProduct[];
};

export default function SupplierDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/v1/supplier/dashboard?days=30&lowStockThreshold=5", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await response.json();
      if (!response.ok) throw new Error(res?.message || "Failed to load dashboard");
      setData(res.data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (loading) return <div style={containerStyle}>Loading dashboard...</div>;
  if (!data) return <div style={containerStyle}>Failed to load.</div>;

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Dashboard</h1>
      <div style={gridStyle}>
        <div style={cardStyle}>
          <div style={cardLabel}>Total Revenue/30d</div>
          <div style={cardValue}>${data.totalRevenue.toFixed(2)}</div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabel}>Orders (Cancel Rate)</div>
          <div style={cardValue}>{data.totalOrders} <span style={{fontSize: 14, color: "#ef4444"}}>({data.cancelRate}%)</span></div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabel}>Active Products</div>
          <div style={cardValue}>{data.totalProducts} <span style={{fontSize: 14, color: "#eab308"}}>({data.lowStockCount} low stock)</span></div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabel}>Available Balance</div>
          <div style={cardValue}>${data.availableBalance.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2 style={sectionTitleStyle}>Top Selling Products</h2>
        <div style={tableContainer}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Sold Qty</th>
                <th style={thStyle}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.topSellingProducts.length === 0 ? (
                <tr><td colSpan={3} style={tdStyle}>No sales yet.</td></tr>
              ) : data.topSellingProducts.map(p => (
                <tr key={p.productId}>
                  <td style={tdStyle}><strong>{p.productName}</strong><br/><span style={mutedStyle}>{p.productId}</span></td>
                  <td style={tdStyle}>{p.soldQty}</td>
                  <td style={tdStyle}>${p.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = { padding: "40px", maxWidth: 1200, margin: "0 auto", animation: "pageIn 400ms ease" };
const titleStyle: CSSProperties = { margin: "0 0 24px", fontSize: 28 };
const sectionTitleStyle: CSSProperties = { margin: "0 0 16px", fontSize: 20 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 };
const cardStyle: CSSProperties = { background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" };
const cardLabel: CSSProperties = { color: "#6b7280", fontSize: 14, fontWeight: 500 };
const cardValue: CSSProperties = { color: "#111827", fontSize: 28, fontWeight: 700, marginTop: 8 };
const tableContainer: CSSProperties = { background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: CSSProperties = { background: "#f9fafb", padding: "12px 24px", textAlign: "left", fontSize: 13, textTransform: "uppercase", color: "#6b7280", borderBottom: "1px solid #e5e7eb" };
const tdStyle: CSSProperties = { padding: "16px 24px", borderBottom: "1px solid #e5e7eb", fontSize: 14 };
const mutedStyle: CSSProperties = { color: "#6b7280", fontSize: 13 };
