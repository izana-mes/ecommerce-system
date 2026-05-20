"use client";

import { CSSProperties, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getUser } from "@/lib/auth";

type TopProduct = { productId: string; productName: string; soldQty: number; revenue: number };
type RestockSuggestion = {
  productId: string;
  productName: string;
  stockQuantity: number;
  soldLast30Days: number;
  daysOfCover: number;
  urgency: "critical" | "high" | "medium" | "watch";
};

type DashboardData = {
  totalRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  avgStockPerProduct: number;
  availableBalance: number;
  pendingBalance: number;
  topSellingProducts: TopProduct[];
  restockSuggestions: RestockSuggestion[];
};

export default function SupplierDashboardPage() {
  const token = getUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/v1/supplier/dashboard?days=30&lowStockThreshold=8", {
        headers: { }});
      const res = await response.json();
      if (!response.ok) throw new Error(res?.message || "Failed to load supplier dashboard");
      setData(res.data);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load supplier dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (loading) return <div style={containerStyle}>Loading supplier command center...</div>;
  if (!data) return <div style={containerStyle}>Unable to load supplier dashboard.</div>;

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Supplier Command Center</h1>
      <p style={subtitleStyle}>Stock pressure, restock urgency, and wholesale operations snapshot.</p>

      <div style={kpiGridStyle}>
        <Kpi label="Out of Stock" value={String(data.outOfStockCount)} tone="#dc2626" />
        <Kpi label="Low Stock SKUs" value={String(data.lowStockCount)} tone="#ea580c" />
        <Kpi label="Avg Units / SKU" value={data.avgStockPerProduct.toFixed(1)} tone="#0f766e" />
        <Kpi label="Supplier Revenue" value={`$${data.totalRevenue.toFixed(2)}`} tone="#1d4ed8" />
      </div>

      <div style={twoColStyle}>
        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>Restock Radar</h2>
          {data.restockSuggestions.length === 0 ? (
            <div style={emptyStyle}>No urgent restock items.</div>
          ) : (
            data.restockSuggestions.map((item) => (
              <div key={item.productId} style={radarRowStyle}>
                <div>
                  <div style={productNameStyle}>{item.productName}</div>
                  <div style={productMetaStyle}>{item.productId}</div>
                </div>
                <div style={metricStyle}>Stock: {item.stockQuantity}</div>
                <div style={metricStyle}>30d sold: {item.soldLast30Days}</div>
                <div style={metricStyle}>
                  Cover: {item.daysOfCover >= 999 ? "N/A" : `${item.daysOfCover}d`}
                </div>
                <span style={{ ...badgeStyle, background: urgencyColor(item.urgency) }}>
                  {item.urgency.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>Wholesale Health</h2>
          <div style={healthRowStyle}>
            <span>Total Products</span>
            <strong>{data.totalProducts}</strong>
          </div>
          <div style={healthRowStyle}>
            <span>Total Orders</span>
            <strong>{data.totalOrders}</strong>
          </div>
          <div style={healthRowStyle}>
            <span>Cancelled Orders</span>
            <strong>{data.cancelledOrders} ({data.cancelRate.toFixed(2)}%)</strong>
          </div>
          <div style={healthRowStyle}>
            <span>Available Balance</span>
            <strong>${data.availableBalance.toFixed(2)}</strong>
          </div>
          <div style={healthRowStyle}>
            <span>Pending Balance</span>
            <strong>${data.pendingBalance.toFixed(2)}</strong>
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, marginTop: 16 }}>
        <h2 style={panelTitleStyle}>Top Wholesale Movers</h2>
        {data.topSellingProducts.length === 0 ? (
          <div style={emptyStyle}>No sales data yet.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Sold Qty</th>
                <th style={thStyle}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.topSellingProducts.map((product) => (
                <tr key={product.productId}>
                  <td style={tdStyle}>{product.productName}</td>
                  <td style={tdStyle}>{product.soldQty}</td>
                  <td style={tdStyle}>${product.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ ...kpiCardStyle, borderColor: tone }}>
      <div style={kpiLabelStyle}>{label}</div>
      <div style={{ ...kpiValueStyle, color: tone }}>{value}</div>
    </div>
  );
}

function urgencyColor(urgency: RestockSuggestion["urgency"]) {
  if (urgency === "critical") return "#b91c1c";
  if (urgency === "high") return "#c2410c";
  if (urgency === "medium") return "#a16207";
  return "#334155";
}

const containerStyle: CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "28px 20px 44px" };
const titleStyle: CSSProperties = { margin: 0, fontSize: 30, color: "#0f172a", letterSpacing: "-0.01em" };
const subtitleStyle: CSSProperties = { marginTop: 8, color: "#475569" };
const kpiGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginTop: 16 };
const kpiCardStyle: CSSProperties = { background: "#f8fafc", border: "2px solid", borderRadius: 14, padding: "16px 18px" };
const kpiLabelStyle: CSSProperties = { fontSize: 12, color: "#334155", textTransform: "uppercase", letterSpacing: ".07em" };
const kpiValueStyle: CSSProperties = { marginTop: 8, fontSize: 30, fontWeight: 800 };
const twoColStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginTop: 12 };
const panelStyle: CSSProperties = { background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 };
const panelTitleStyle: CSSProperties = { margin: "0 0 12px", fontSize: 18, color: "#0f172a" };
const radarRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1.2fr .7fr .7fr .7fr auto", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "1px dashed #e2e8f0" };
const productNameStyle: CSSProperties = { fontWeight: 700, color: "#0f172a" };
const productMetaStyle: CSSProperties = { fontSize: 12, color: "#64748b", fontFamily: "monospace" };
const metricStyle: CSSProperties = { fontSize: 13, color: "#334155" };
const badgeStyle: CSSProperties = { color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "5px 10px" };
const healthRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", padding: "10px 0", color: "#1e293b", fontSize: 14 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: CSSProperties = { textAlign: "left", background: "#f8fafc", color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", padding: "10px 12px" };
const tdStyle: CSSProperties = { padding: "12px", borderTop: "1px solid #f1f5f9", color: "#0f172a" };
const emptyStyle: CSSProperties = { color: "#64748b", fontSize: 14, padding: "8px 0" };
