"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";
import Link from "next/link";

type SlaOrderDto = {
  id: number;
  orderNumber: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  orderStatus: string;
  paymentStatus: string;
  shipperUserId: string | null;
  shipperEmail: string | null;
  totalAmount: number;
  currency: string;
  expectedDeliveryAt: string;
  createdAt: string;
  minutesLate: number;
  slaStatus: "ON_TIME" | "NEAR_LATE" | "LATE";
};

export default function StaffSlaPage() {
  const [lateOrders, setLateOrders] = useState<SlaOrderDto[]>([]);
  const [nearLateOrders, setNearLateOrders] = useState<SlaOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"LATE" | "NEAR_LATE">("LATE");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken();

      const [lateRes, nearRes] = await Promise.all([
        fetch(`/api/v1/staff/sla/late`, { headers: { } }),
        fetch(`/api/v1/staff/sla/near-late?thresholdMinutes=30`, { headers: { } }),
      ]);

      if (!lateRes.ok || !nearRes.ok) throw new Error("Failed to load SLA tracking data");

      setLateOrders(await lateRes.json());
      setNearLateOrders(await nearRes.json());
    } catch (err: any) {
      toast.error(err.message || "Failed to load SLA data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 60000); // refresh every minute
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const activeData = tab === "LATE" ? lateOrders : nearLateOrders;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700, color: "#111827" }}>
        SLA Monitoring
      </h1>
      <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: 14 }}>
        Tracking active shipments against expected delivery deadlines. Refreshes every minute.
      </p>
      
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <button 
          onClick={() => setTab("LATE")}
          style={{ padding: "8px 16px", borderRadius: 20, fontSize: 14, fontWeight: 500, cursor: "pointer", 
                   border: tab === "LATE" ? "none" : "1px solid #d1d5db", 
                   background: tab === "LATE" ? "#ef4444" : "#fff",
                   color: tab === "LATE" ? "#fff" : "#ef4444" }}
        >
          Overdue Orders ({lateOrders.length})
        </button>
        <button 
          onClick={() => setTab("NEAR_LATE")}
          style={{ padding: "8px 16px", borderRadius: 20, fontSize: 14, fontWeight: 500, cursor: "pointer", 
                   border: tab === "NEAR_LATE" ? "none" : "1px solid #d1d5db", 
                   background: tab === "NEAR_LATE" ? "#f97316" : "#fff",
                   color: tab === "NEAR_LATE" ? "#f97316" : "#f97316" }}
        >
          Near-Late / At Risk ({nearLateOrders.length})
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}>
        {loading && activeData.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading SLA data...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "15%" }}>Order #</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "20%" }}>Customer</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "20%" }}>Shipper</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "15%" }}>Status</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "20%" }}>Deadline</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500, width: "10%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeData.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                      Awesome! No {tab === "LATE" ? "overdue" : "at-risk"} orders.
                    </td>
                  </tr>
                ) : (
                  activeData.map(order => (
                    <tr key={order.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "16px", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                        #{order.orderNumber}
                      </td>
                      <td style={{ padding: "16px", fontSize: 13, color: "#4b5563" }}>
                        <div>{order.customerFirstName} {order.customerLastName}</div>
                        <div style={{ color: "#6b7280" }}>{order.customerEmail}</div>
                      </td>
                      <td style={{ padding: "16px", fontSize: 13, color: "#4b5563" }}>
                        {order.shipperUserId ? (
                          <div style={{ color: "#111827", fontWeight: 500 }}>{order.shipperEmail}</div>
                        ) : (
                          <span style={{ color: "#ef4444", fontWeight: 500 }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ padding: "16px", fontSize: 13, textTransform: "capitalize" }}>
                        {order.orderStatus}
                      </td>
                      <td style={{ padding: "16px", fontSize: 13 }}>
                        <div style={{ color: "#111827", fontWeight: 500 }}>{new Date(order.expectedDeliveryAt).toLocaleString()}</div>
                        <div style={{ color: order.minutesLate > 0 ? "#ef4444" : "#f59e0b", fontWeight: 600, marginTop: 4 }}>
                          {order.minutesLate > 0 
                            ? `${order.minutesLate} mins overdue` 
                            : `Due in ${Math.abs(order.minutesLate)} mins`}
                        </div>
                      </td>
                      <td style={{ padding: "16px" }}>
                        <Link 
                          href="/staff/orders"
                          style={{ padding: "6px 12px", fontSize: 13, background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, textDecoration: "none", fontWeight: 500, display: "inline-block" }}
                        >
                          Resolve
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
