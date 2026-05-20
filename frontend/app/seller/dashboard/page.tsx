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

// Simple SVG sparkline that fits the data without any external library
function Sparkline({ data }: { data: RevenuePoint[] }) {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 14 }}>
        No revenue data for this period
      </div>
    );
  }

  const WIDTH = 700;
  const HEIGHT = 120;
  const PAD = 10;

  const revenues = data.map((d) => Number(d.revenue));
  const maxRev = Math.max(...revenues, 1);
  const minRev = Math.min(...revenues);

  const points = data.map((d, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (WIDTH - PAD * 2);
    const y = PAD + ((maxRev - Number(d.revenue)) / (maxRev - minRev || 1)) * (HEIGHT - PAD * 2);
    return { x, y, day: d.day, revenue: d.revenue, orders: d.orders };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const fillPoints = [
    `${PAD},${HEIGHT - PAD}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${WIDTH - PAD},${HEIGHT - PAD}`,
  ].join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", display: "block", minWidth: 280 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill="url(#sparkGrad)" />
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#6366f1" />
        ))}
      </svg>
      {/* X-axis labels — show first, middle, last */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, padding: "0 8px" }}>
        {[data[0], data[Math.floor(data.length / 2)], data[data.length - 1]].filter(Boolean).map((d, i) => (
          <span key={i} style={{ color: "#94a3b8", fontSize: 11 }}>
            {d.day ? d.day.slice(5) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SellerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchDashboard = useCallback(async (daysParam = 30) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(
        `/api/v1/seller/dashboard?days=${daysParam}&lowStockThreshold=5`,
        { headers: { } }
      );
      const resData = await res.json();
      if (!res.ok) throw new Error(resData?.message || "Failed to load dashboard");
      setData(resData.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchDashboard(days); }, [fetchDashboard, days]);

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ height: 52, background: "#e2e8f0", borderRadius: 12, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} style={{ height: 110, background: "#e2e8f0", borderRadius: 14 }} />)}
        </div>
        <div style={{ height: 220, background: "#e2e8f0", borderRadius: 16, marginBottom: 24 }} />
        <div style={{ height: 300, background: "#e2e8f0", borderRadius: 16 }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: "center", padding: "80px 24px", color: "#64748b" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Failed to load dashboard</div>
          <button
            type="button"
            onClick={() => { setLoading(true); void fetchDashboard(days); }}
            style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 600, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={titleStyle}>Dashboard</h1>
          <p style={subtitleStyle}>Performance overview for your seller account</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { setDays(d); setLoading(true); void fetchDashboard(d); }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: days === d ? "#0f172a" : "#fff",
                color: days === d ? "#fff" : "#475569",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"}}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div style={kpiGridStyle}>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Revenue ({days}d)</div>
          <div style={{ ...kpiValueStyle, color: "#6366f1" }}>${data.totalRevenue.toFixed(2)}</div>
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Total Orders</div>
          <div style={kpiValueStyle}>{data.totalOrders}</div>
          {data.cancelRate > 0 && (
            <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>
              {data.cancelledOrders} cancelled ({data.cancelRate}%)
            </div>
          )}
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Active Products</div>
          <div style={kpiValueStyle}>{data.totalProducts}</div>
          {data.lowStockCount > 0 && (
            <div style={{ color: "#f59e0b", fontSize: 12, marginTop: 4 }}>
              {data.lowStockCount} low stock
            </div>
          )}
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Available Balance</div>
          <div style={{ ...kpiValueStyle, color: "#22c55e" }}>${data.availableBalance.toFixed(2)}</div>
          {data.pendingBalance > 0 && (
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
              +${data.pendingBalance.toFixed(2)} pending
            </div>
          )}
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div style={panelStyle}>
        <h2 style={panelTitleStyle}>Revenue Trend</h2>
        <Sparkline data={data.revenueByDay} />
      </div>

      {/* Top Selling Products */}
      <div style={{ ...panelStyle, marginTop: 20 }}>
        <h2 style={panelTitleStyle}>Top Selling Products</h2>
        {data.topSellingProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 14 }}>
            No sales data yet
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
            <thead>
              <tr>
                {["#", "Product", "Sold Qty", "Revenue"].map((h) => (
                  <th key={h} style={{ background: "#f8fafc", padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.topSellingProducts.map((p, i) => (
                <tr key={p.productId}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: i < 3 ? "#6366f1" : "#94a3b8" }}>#{i + 1}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{p.productName}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{p.productId}</div>
                  </td>
                  <td style={tdStyle}><strong>{p.soldQty}</strong></td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#6366f1" }}>${p.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = { padding: "36px 32px", maxWidth: 1200, margin: "0 auto" };
const pageHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 28 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" };
const subtitleStyle: CSSProperties = { margin: "6px 0 0", color: "#64748b", fontSize: 14 };
const kpiGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 };
const kpiCardStyle: CSSProperties = { background: "#fff", borderRadius: 14, padding: "22px 24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", border: "1px solid #e2e8f0" };
const kpiLabelStyle: CSSProperties = { color: "#64748b", fontSize: 13, fontWeight: 500, marginBottom: 8 };
const kpiValueStyle: CSSProperties = { fontSize: 30, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" };
const panelStyle: CSSProperties = { background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", border: "1px solid #e2e8f0" };
const panelTitleStyle: CSSProperties = { margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "#0f172a" };
const tdStyle: CSSProperties = { padding: "14px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 14, color: "#334155", verticalAlign: "middle" };
