"use client";

import { useEffect, useState } from "react";
import {}  from "@/lib/auth";
import toast from "react-hot-toast";

type DashboardRevenuePoint = {
  day: string;
  orders: number;
  revenue: number;
};

type StaffDashboardDto = {
  ordersToday: number;
  revenueToday: number;
  activeShippers: number;
  lateDeliveries: number;
  nearLateDeliveries: number;
  pendingOrders: number;
  processingOrders: number;
  revenueByDay: DashboardRevenuePoint[];
};

export default function StaffDashboardPage() {
  const [data, setData] = useState<StaffDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/staff/dashboard", {
        credentials: 'include',
        headers: { Accept: "application/json" }});
      if (!res.ok) throw new Error("Failed to fetch staff dashboard");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading dashboard...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "red" }}>Failed to load dashboard.</div>;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 700, color: "#111827" }}>
        Staff Dashboard
      </h1>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
        marginBottom: 32
      }}>
        <MetricCard title="Orders Today" value={data.ordersToday} />
        <MetricCard title="Revenue Today" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.revenueToday)} />
        <MetricCard title="Active Shippers" value={data.activeShippers} color="#10b981" />
        <MetricCard title="Pending Orders" value={data.pendingOrders} color="#f59e0b" />
        <MetricCard title="Late Deliveries" value={data.lateDeliveries} color="#ef4444" />
        <MetricCard title="Near-Late Deliveries" value={data.nearLateDeliveries} color="#f97316" />
      </div>

      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"}}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600, color: "#374151" }}>7-Day Revenue Trend</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f9fafb", color: "#6b7280", fontSize: 12, textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Orders</th>
                <th style={{ padding: "12px 16px" }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.revenueByDay.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: "16px", textAlign: "center", color: "#6b7280" }}>
                    No revenue data found for the last 7 days.
                  </td>
                </tr>
              ) : (
                data.revenueByDay.map((pt, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "12px 16px", color: "#111827", fontWeight: 500 }}>{pt.day}</td>
                    <td style={{ padding: "12px 16px", color: "#4b5563" }}>{pt.orders}</td>
                    <td style={{ padding: "12px 16px", color: "#10b981", fontWeight: 600 }}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(pt.revenue)}
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

function MetricCard({ title, value, color = "#4f46e5" }: { title: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      padding: 20,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      display: "flex",
      flexDirection: "column",
      gap: 8
    }}>
      <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>{title}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
