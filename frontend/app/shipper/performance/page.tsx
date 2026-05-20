"use client";

import { useCallback, useEffect, useState } from "react";
import { MdBarChart, MdSearch, MdRefresh } from "react-icons/md";
import { getToken, getUser } from "@/lib/auth";
import toast from "react-hot-toast";

interface PerformanceResponse {
  shipperUserId: string;
  from: string;
  to: string;
  completedDeliveries: number;
  failedDeliveries: number;
  successRatePercent: number;
  averageDeliveryMinutes: number;
  lateDeliveries: number;
}

function ProgressRow({
  label,
  value,
  max,
  color,
  suffix = ""}: {
  label: string;
  value: number;
  max: number;
  color: "blue" | "green" | "amber" | "red";
  suffix?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#94a3b8" }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
          {value}
          {suffix}
        </span>
      </div>
      <div className="sh-progress-track">
        <div
          className={`sh-progress-fill ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ShipperPerformancePage() {
  const user = getUser();
  const shipperUserId = user?.id as string | undefined;

  const today = new Date().toISOString().slice(0, 16);
  const minus30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  const [from, setFrom] = useState(minus30);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPerf = useCallback(async () => {
    const token = getToken();
    if (!token || !shipperUserId) return;
    setLoading(true);
    try {
      // Spring @DateTimeFormat(ISO.DATE_TIME) expects e.g. 2026-04-04T03:23:00 (not a space separator).
      const toIsoParam = (v: string) => {
        const t = v.trim();
        if (t.length === 16) return `${t}:00`; // datetime-local: yyyy-MM-ddTHH:mm
        return t;
      };
      const params = new URLSearchParams({
        from: toIsoParam(from),
        to: toIsoParam(to)});
      const res = await fetch(
        `/api/v1/shipper/shippers/${shipperUserId}/performance?${params}`,
        { headers: { } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to fetch performance");
      setData(json.data ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [shipperUserId, from, to]);

  useEffect(() => { void fetchPerf(); }, [fetchPerf]);

  const totalDone = (data?.completedDeliveries ?? 0) + (data?.failedDeliveries ?? 0);

  return (
    <>
      <div className="sh-topbar">
        <div className="sh-topbar-title">
          <h1>Performance Analytics</h1>
          <p>SLA tracking, delivery stats, and efficiency metrics</p>
        </div>
        <div className="sh-topbar-actions">
          <button
            className="sh-btn sh-btn-secondary sh-btn-sm"
            onClick={() => void fetchPerf()}
            disabled={loading}
          >
            <MdRefresh /> {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="sh-content">
        <div className="sh-section-gap">

          {/* ── Date range filter ── */}
          <div className="sh-card">
            <div className="sh-card-header">
              <div>
                <h2 className="sh-card-title">Date Range</h2>
                <p className="sh-card-subtitle">Filter performance stats by time window</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="sh-form-group" style={{ flex: 1, minWidth: 200 }}>
                <label className="sh-label">From</label>
                <input
                  type="datetime-local"
                  className="sh-input"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="sh-form-group" style={{ flex: 1, minWidth: 200 }}>
                <label className="sh-label">To</label>
                <input
                  type="datetime-local"
                  className="sh-input"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <button
                className="sh-btn sh-btn-primary"
                onClick={() => void fetchPerf()}
                disabled={loading}
              >
                <MdSearch /> {loading ? "Fetching…" : "Query Stats"}
              </button>
            </div>
          </div>

          {/* ── KPI grid ── */}
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
          ) : data ? (
            <>
              <div className="sh-stats-grid">
                {[
                  { label: "Completed Deliveries", value: data.completedDeliveries, color: "green" as const, suffix: "" },
                  { label: "Failed Deliveries", value: data.failedDeliveries, color: "red" as const, suffix: "" },
                  { label: "Success Rate", value: (data.successRatePercent ?? 0).toFixed(1), color: "blue" as const, suffix: "%" },
                  { label: "Avg Delivery Time", value: Math.round(data.averageDeliveryMinutes ?? 0), color: "cyan" as const, suffix: " min" },
                  { label: "Late Deliveries", value: data.lateDeliveries, color: "amber" as const, suffix: "" },
                ].map((stat) => (
                  <div key={stat.label} className={`sh-stat-card ${stat.color}`}>
                    <div className={`sh-stat-icon ${stat.color}`}>
                      <MdBarChart />
                    </div>
                    <div>
                      <div className="sh-stat-value">
                        {stat.value}
                        {stat.suffix}
                      </div>
                      <div className="sh-stat-label">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Breakdown chart ── */}
              <div className="sh-card">
                <div className="sh-card-header">
                  <div>
                    <h2 className="sh-card-title">Delivery Breakdown</h2>
                    <p className="sh-card-subtitle">
                      Period: {new Date(data.from).toLocaleDateString()} →{" "}
                      {new Date(data.to).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <ProgressRow
                    label="Completed"
                    value={data.completedDeliveries}
                    max={totalDone || 1}
                    color="green"
                    suffix={` of ${totalDone}`}
                  />
                  <ProgressRow
                    label="Failed"
                    value={data.failedDeliveries}
                    max={totalDone || 1}
                    color="red"
                    suffix={` of ${totalDone}`}
                  />
                  <ProgressRow
                    label="Late Deliveries"
                    value={data.lateDeliveries}
                    max={data.completedDeliveries || 1}
                    color="amber"
                    suffix={` of ${data.completedDeliveries} completed`}
                  />
                  <ProgressRow
                    label="Success Rate"
                    value={parseFloat((data.successRatePercent ?? 0).toFixed(1))}
                    max={100}
                    color="blue"
                    suffix="%"
                  />
                </div>

                {/* Summary callout */}
                <div
                  style={{
                    marginTop: 24,
                    padding: 16,
                    borderRadius: 12,
                    background:
                      data.successRatePercent >= 90
                        ? "rgba(16, 185, 129, 0.08)"
                        : data.successRatePercent >= 70
                        ? "rgba(245, 158, 11, 0.08)"
                        : "rgba(239, 68, 68, 0.08)",
                    border: `1px solid ${
                      data.successRatePercent >= 90
                        ? "rgba(16, 185, 129, 0.2)"
                        : data.successRatePercent >= 70
                        ? "rgba(245, 158, 11, 0.2)"
                        : "rgba(239, 68, 68, 0.2)"
                    }`}}
                >
                  <p style={{ margin: 0, fontSize: 14, color: "#f1f5f9" }}>
                    {data.successRatePercent >= 90
                      ? "🏆 Excellent performance! You are maintaining a high delivery success rate."
                      : data.successRatePercent >= 70
                      ? "📊 Good performance. Room to improve on late and failed deliveries."
                      : "⚠️ Performance needs attention. Focus on reducing failed and late deliveries."}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="sh-card" style={{ textAlign: "center", padding: "48px 16px", color: "#475569" }}>
              No data available for the selected period.
            </div>
          )}

        </div>
      </div>
    </>
  );
}
