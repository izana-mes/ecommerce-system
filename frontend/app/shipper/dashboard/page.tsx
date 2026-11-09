"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  TrendingUp,
  Clock,
  AlertTriangle,
  Truck,
  RotateCw,
  MapPin,
  ClipboardList,
  BarChart2,
  PackageCheck,
  ChevronRight,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { useShipperSocket } from "@/hooks/useShipperSocket";
import RoleAssistantLauncher from "@/components/management/RoleAssistantLauncher";

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

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  suffix = "",
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  color: "blue" | "green" | "amber" | "red" | "cyan";
  suffix?: string;
}) {
  return (
    <div className={`sh-stat-card ${color}`}>
      <div className={`sh-stat-icon ${color}`}>
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div>
        <div className="sh-stat-value">
          {value}
          {suffix}
        </div>
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
        to: new Date().toISOString().slice(0, 19),
      });
      const res = await fetch(
        `/api/v1/shipper/shippers/${shipperUserId}/performance?${params.toString()}`,
        { headers: {} }
      );
      const data = await res.json();
      if (res.ok && data?.data) setStats(data.data);
    } catch {
      /* silent */
    }
  }, [shipperUserId, token]);

  const fetchActiveOrder = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/shipper/orders?activeOnly=true&limit=1`, {
        headers: {},
      });
      const data = await res.json();
      if (!res.ok) return;
      const first: AssignedOrderItem | undefined = Array.isArray(data?.data) ? data.data[0] : undefined;
      if (!first) {
        setActiveOrder(null);
        return;
      }
      setActiveOrder({
        orderId: first.orderId,
        orderNumber: first.orderNumber,
        orderStatus: first.orderStatus,
        expectedDeliveryAt: first.expectedDeliveryAt,
        pickedUpAt: first.pickedUpAt,
        deliveredAt: first.deliveredAt,
      });
    } catch {
      /* silent */
    }
  }, [token]);

  const load = useCallback(async () => {
    if (!user) {
      router.replace("/login?returnTo=/shipper/dashboard");
      return;
    }
    setLoading(true);
    await Promise.all([fetchStats(), fetchActiveOrder()]);
    setLoading(false);
  }, [user, router, fetchStats, fetchActiveOrder]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  // Real-time: re-fetch silently whenever an order-status event arrives
  const { connected } = useShipperSocket(shipperUserId, () => {
    void fetchStats();
    void fetchActiveOrder();
  });

  const fmtTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="sh-topbar">
        <div className="sh-topbar-title">
          <h1>Delivery Overview</h1>
        </div>
        <div className="sh-topbar-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              className={connected ? "sh-live-dot" : undefined}
              style={
                !connected
                  ? { width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }
                  : {}
              }
            />
            <span style={{ fontSize: 12, color: connected ? "#34d399" : "#f87171", fontWeight: 500 }}>
              {connected ? "Live Dispatch" : "Offline"}
            </span>
          </div>
          <button className="sh-btn sh-btn-secondary sh-btn-sm" onClick={() => void load()}>
            <RotateCw size={14} strokeWidth={1.75} />
            <span>Refresh</span>
          </button>
          <Link href="/shipper/orders" className="sh-btn sh-btn-primary sh-btn-sm">
            <Truck size={14} strokeWidth={1.75} />
            <span>View Orders</span>
          </Link>
        </div>
      </div>

      <div className="sh-content">
        <div className="sh-section-gap">
          {loading ? (
            <div className="sh-stats-grid">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="sh-stat-card" style={{ height: 100 }}>
                  <div className="sh-skeleton" style={{ height: 36, width: 36, borderRadius: 5 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    <div className="sh-skeleton" style={{ height: 24, width: 70 }} />
                    <div className="sh-skeleton" style={{ height: 12, width: 110 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sh-stats-grid">
              <StatCard
                label="Completed (30d)"
                value={stats?.completedDeliveries ?? 0}
                icon={CheckCircle2}
                color="green"
              />
              <StatCard
                label="Success Rate"
                value={stats?.successRatePercent?.toFixed(1) ?? "0.0"}
                icon={TrendingUp}
                color="blue"
                suffix="%"
              />
              <StatCard
                label="Avg Delivery Time"
                value={stats?.averageDeliveryMinutes?.toFixed(0) ?? "0"}
                icon={Clock}
                color="cyan"
                suffix=" min"
              />
              <StatCard
                label="Late Deliveries (30d)"
                value={stats?.lateDeliveries ?? 0}
                icon={AlertTriangle}
                color="amber"
              />
              <StatCard
                label="Failed Deliveries"
                value={stats?.failedDeliveries ?? 0}
                icon={Truck}
                color="red"
              />
            </div>
          )}

          {/* Active Order Card */}
          <div className="sh-card">
            <div className="sh-card-header">
              <div>
                <h2 className="sh-card-title">Active Delivery</h2>
              </div>
              <Link href="/shipper/orders" className="sh-btn sh-btn-secondary sh-btn-sm">
                <span>All Orders</span>
                <ChevronRight size={14} strokeWidth={1.75} />
              </Link>
            </div>
            {activeOrder ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                {[
                  { label: "Order Reference", value: activeOrder.orderNumber },
                  {
                    label: "Current Status",
                    value: <span className="sh-badge sh-badge-blue">{activeOrder.orderStatus}</span>,
                  },
                  { label: "Picked Up Timestamp", value: fmtTime(activeOrder.pickedUpAt) },
                  { label: "Expected Delivery", value: fmtTime(activeOrder.expectedDeliveryAt) },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#737373" }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 16px",
                  color: "#737373",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 5,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--sh-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#737373",
                  }}
                >
                  <PackageCheck size={22} strokeWidth={1.5} />
                </div>
                <div>
                  <p style={{ fontWeight: 500, color: "#d4d4d4", fontSize: 14, margin: 0 }}>No active order assigned</p>
                  <p style={{ fontSize: 13, color: "#737373", margin: "4px 0 0" }}>
                    Review pending dispatches in your orders queue to accept a delivery.
                  </p>
                </div>
                <Link href="/shipper/orders" className="sh-btn sh-btn-primary sh-btn-sm" style={{ marginTop: 4 }}>
                  <Truck size={14} strokeWidth={1.75} />
                  <span>View Pending Orders</span>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="sh-card">
            <div className="sh-card-header">
              <div>
                <h2 className="sh-card-title">Quick Actions</h2>
              </div>
            </div>
            <div className="sh-quick-actions">
              <Link href="/shipper/tracking" className="sh-quick-action-btn">
                <span className="sh-quick-action-icon">
                  <MapPin size={20} strokeWidth={1.75} />
                </span>
                <span>Update Location</span>
              </Link>
              <Link href="/shipper/orders" className="sh-quick-action-btn">
                <span className="sh-quick-action-icon">
                  <ClipboardList size={20} strokeWidth={1.75} />
                </span>
                <span>Update Order Status</span>
              </Link>
              <Link href="/shipper/issues" className="sh-quick-action-btn">
                <span className="sh-quick-action-icon">
                  <AlertTriangle size={20} strokeWidth={1.75} />
                </span>
                <span>Report Delivery Issue</span>
              </Link>
              <Link href="/shipper/performance" className="sh-quick-action-btn">
                <span className="sh-quick-action-icon">
                  <BarChart2 size={20} strokeWidth={1.75} />
                </span>
                <span>View Analytics</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <RoleAssistantLauncher role="shipper" />
    </>
  );
}
