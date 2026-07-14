"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MdLocalShipping, MdCheckCircle, MdTimer, MdWarning,
  MdRefresh, MdTrendingUp, MdLocationOn, MdAssignment, MdBarChart} from "react-icons/md";
import {getUser } from "@/lib/auth";
import { useShipperSocket } from "@/hooks/useShipperSocket";

interface PerformanceStats {
  completedDeliveries: number;
  failedDeliveries: number;
  successRatePercent: number;
  averageDeliveryMinutes: number;
  lateDeliveries: number;
}

interface OrderTracking {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  expectedDeliveryAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
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

function StatCard({ label, value, icon, color, suffix = "" }: {
  label: string; value: number | string; icon: React.ReactNode;
  color: "blue" | "green" | "amber" | "red" | "cyan"; suffix?: string;
}) {
  return (
    <div className={`sh-stat-card ${color}`}>
      <div className={`sh-stat-icon ${color}`}>{icon}</div>
      <div>
        <div className="sh-stat-value">{value}{suffix}</div>
        <div className="sh-stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function ShipperDashboardPage() {
  const router = useRouter();
  const token = getUser();
  const user = getUser();
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const shipperUserId = user?.id as string | undefined;

  const fetchStats = useCallback(async () => {
    if (!token || !shipperUserId) return;
    try {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const params = new URLSearchParams({
        from: from.toISOString().slice(0, 19),
        to: new Date().toISOString().slice(0, 19)});
      const res = await fetch(
        `/api/v1/shipper/shippers/${shipperUserId}/performance?${params.toString()}`,
        { headers: { } }
      );
      const data = await res.json();
      if (res.ok && data?.data) setStats(data.data);
    } catch { /* silent */ }
  }, [shipperUserId]);

  const fetchActiveOrder = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/shipper/orders?activeOnly=true&limit=1`, {
        headers: { }});
      const data = await res.json();
      if (!res.ok) return;
      const first: AssignedOrderItem | undefined = Array.isArray(data?.data) ? data.data[0] : undefined;
      if (!first) { setActiveOrder(null); return; }
      setActiveOrder({
        orderId: first.orderId,
        orderNumber: first.orderNumber,
        orderStatus: first.orderStatus,
        expectedDeliveryAt: first.expectedDeliveryAt,
        pickedUpAt: first.pickedUpAt,
        deliveredAt: first.deliveredAt});
    } catch { /* silent */ }
  }, []);

  const load = useCallback(async () => {
    if (!user) { router.replace("/login?returnTo=/shipper/dashboard"); return; }
    setLoading(true);
    await Promise.all([fetchStats(), fetchActiveOrder()]);
    setLoading(false);
  }, [user, router, fetchStats, fetchActiveOrder]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  // ── Real-time: re-fetch silently whenever an order-status event arrives ──
  const { connected } = useShipperSocket(shipperUserId, () => {
    void fetchStats();
    void fetchActiveOrder();
  });

  const fmtTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "Shipper";

  return (
    <>
      <div className="sh-topbar">
        <div className="sh-topbar-title">
          <h1>👋 Welcome back, {displayName.split(" ")[0]}</h1>
          <p>Here&apos;s what&apos;s happening with your deliveries today</p>
        </div>
        <div className="sh-topbar-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              className={connected ? "sh-live-dot" : undefined}
              style={!connected ? { width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" } : {}}
            />
            <span style={{ fontSize: 12, color: connected ? "#34d399" : "#f87171" }}>
              {connected ? "Live" : "Offline"}
            </span>
          </div>
          <button className="sh-btn sh-btn-secondary sh-btn-sm" onClick={() => void load()}>
            <MdRefresh /> Refresh
          </button>
          <Link href="/shipper/orders" className="sh-btn sh-btn-primary sh-btn-sm">
            <MdLocalShipping /> View Orders
          </Link>
        </div>
      </div>

      <div className="sh-content">
        <div className="sh-section-gap">
          {loading ? (
            <div className="sh-stats-grid">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="sh-stat-card" style={{ height: 120 }}>
                  <div className="sh-skeleton" style={{ height: 40, width: 40, borderRadius: 10 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="sh-skeleton" style={{ height: 28, width: 80 }} />
                    <div className="sh-skeleton" style={{ height: 14, width: 120 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sh-stats-grid">
              <StatCard label="Completed (30d)" value={stats?.completedDeliveries ?? 0} icon={<MdCheckCircle />} color="green" />
              <StatCard label="Success Rate" value={stats?.successRatePercent?.toFixed(1) ?? "0.0"} icon={<MdTrendingUp />} color="blue" suffix="%" />
              <StatCard label="Avg Delivery Time" value={stats?.averageDeliveryMinutes?.toFixed(0) ?? "0"} icon={<MdTimer />} color="cyan" suffix=" min" />
              <StatCard label="Late Deliveries (30d)" value={stats?.lateDeliveries ?? 0} icon={<MdWarning />} color="amber" />
              <StatCard label="Failed (30d)" value={stats?.failedDeliveries ?? 0} icon={<MdLocalShipping />} color="red" />
            </div>
          )}

          <div className="sh-card">
            <div className="sh-card-header">
              <div>
                <h2 className="sh-card-title">Active Order</h2>
                <p className="sh-card-subtitle">Order currently in progress</p>
              </div>
              <Link href="/shipper/orders" className="sh-btn sh-btn-secondary sh-btn-sm">All Orders →</Link>
            </div>
            {activeOrder ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                {[
                  { label: "Order #", value: activeOrder.orderNumber },
                  { label: "Status", value: <span className="sh-badge sh-badge-blue">{activeOrder.orderStatus}</span> },
                  { label: "Picked Up", value: fmtTime(activeOrder.pickedUpAt) },
                  { label: "Expected By", value: fmtTime(activeOrder.expectedDeliveryAt) },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b" }}>{item.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "#475569", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 40 }}>📦</span>
                <span>No active order right now. Check your order list to pick up a delivery.</span>
                <Link href="/shipper/orders" className="sh-btn sh-btn-primary sh-btn-sm">View Orders</Link>
              </div>
            )}
          </div>

          <div className="sh-card">
            <div className="sh-card-header">
              <div>
                <h2 className="sh-card-title">Quick Actions</h2>
                <p className="sh-card-subtitle">Jump to common tasks</p>
              </div>
            </div>
            <div className="sh-quick-actions">
              <Link href="/shipper/tracking" className="sh-quick-action-btn">
                <span className="sh-quick-action-icon"><MdLocationOn /></span>
                Update Location
              </Link>
              <Link href="/shipper/orders" className="sh-quick-action-btn">
                <span className="sh-quick-action-icon"><MdAssignment /></span>
                Update Order Status
              </Link>
              <Link href="/shipper/issues" className="sh-quick-action-btn">
                <span className="sh-quick-action-icon"><MdWarning /></span>
                Report an Issue
              </Link>
              <Link href="/shipper/performance" className="sh-quick-action-btn">
                <span className="sh-quick-action-icon"><MdBarChart /></span>
                View Stats
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
