"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";

type StaffOrderDto = {
  id: number;
  orderNumber: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  orderStatus: string;
  shipperUserId: string | null;
  expectedDeliveryAt: string | null;
  createdAt: string;
  itemCount: number;
};

type ShipperDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  activeOrderCount: number;
};

type AssignedShipperModalProps = {
  orderId: number | null;
  onClose: () => void;
  onAssigned: () => void;
};

function AssignShipperModal({ orderId, onClose, onAssigned }: AssignedShipperModalProps) {
  const [shippers, setShippers] = useState<ShipperDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipper, setSelectedShipper] = useState("");
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const fetchShippers = async () => {
      try {
        const res = await fetch("/api/v1/staff/shippers", {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) setShippers(await res.json());
      } catch (err: any) {
        toast.error("Failed to load shippers");
      } finally {
        setLoading(false);
      }
    };
    fetchShippers();
  }, [orderId]);

  if (!orderId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipper) return toast.error("Please select a shipper");

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/staff/orders/${orderId}/assign-shipper`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ 
          shipperUserId: selectedShipper,
          expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt).toISOString() : null 
        }),
      });

      if (!res.ok) throw new Error("Failed to assign shipper");
      toast.success("Shipper assigned successfully");
      onAssigned();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign shipper");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 12, width: "100%", maxWidth: 400 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>Assign Shipper</h3>
        
        {loading ? (
          <p>Loading shippers...</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Select Shipper</label>
              <select 
                value={selectedShipper} 
                onChange={(e) => setSelectedShipper(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db" }}
                required
              >
                <option value="">-- Choose a shipper --</option>
                {shippers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.email}) - {s.activeOrderCount} in-flight
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Expected Delivery Time (Optional)</label>
              <input 
                type="datetime-local" 
                value={expectedDeliveryAt}
                onChange={(e) => setExpectedDeliveryAt(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>
            
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "transparent", cursor: "pointer" }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
                {submitting ? "Assigning..." : "Assign"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusOverrideModal({ orderId, currentStatus, currentPaymentPath, onClose, onUpdated }: { orderId: number | null, currentStatus: string, currentPaymentPath: string, onClose: () => void, onUpdated: () => void }) {
  const [orderStatus, setOrderStatus] = useState(currentStatus || "");
  const [paymentStatus, setPaymentStatus] = useState(currentPaymentPath || "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setOrderStatus(currentStatus || "");
    setPaymentStatus(currentPaymentPath || "");
    setReason("");
  }, [orderId, currentStatus, currentPaymentPath]);

  if (!orderId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error("Reason is required for audit logs.");

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/staff/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ 
          orderStatus: orderStatus !== currentStatus ? orderStatus : undefined,
          paymentStatus: paymentStatus !== currentPaymentPath ? paymentStatus : undefined,
          reason 
        }),
      });

      if (!res.ok) {
        if (res.status === 403) throw new Error("You do not have permission to override statuses (requires Admin).");
        throw new Error("Failed to override status");
      }
      
      toast.success("Status overridden successfully");
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to override status");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 12, width: "100%", maxWidth: 400 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>Emergency Status Override</h3>
        
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Order Status</label>
            <select 
              value={orderStatus} 
              onChange={(e) => setOrderStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db" }}
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Payment Status</label>
            <select 
              value={paymentStatus} 
              onChange={(e) => setPaymentStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db" }}
            >
              <option value="pending">Pending</option>
              <option value="authorized">Authorized</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Reason (Required for audit log)</label>
            <textarea 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", minHeight: 60 }}
              required
              placeholder="E.g., Manual bank transfer verified"
            />
          </div>
          
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "transparent", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
              {submitting ? "Updating..." : "Force Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffOrdersPage() {
  const [orders, setOrders] = useState<StaffOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  
  // Modals
  const [shipperModalOrderId, setShipperModalOrderId] = useState<number | null>(null);
  
  const [overrideModalOrderId, setOverrideModalOrderId] = useState<number | null>(null);
  const [overrideModalStatus, setOverrideModalStatus] = useState("");
  const [overrideModalPayment, setOverrideModalPayment] = useState("");

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("size", "20");
      if (statusFilter) params.append("status", statusFilter);
      if (paymentFilter) params.append("paymentStatus", paymentFilter);
      
      const res = await fetch(`/api/v1/staff/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch orders");
      const json = await res.json();
      setOrders(json.content || []);
      setTotal(json.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, paymentFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    const bg = ["completed", "delivered", "paid"].includes(s) ? "#d1fae5" :
               ["pending", "processing"].includes(s) ? "#fef3c7" :
               ["failed", "cancelled"].includes(s) ? "#fee2e2" : "#f3f4f6";
    const color = ["completed", "delivered", "paid"].includes(s) ? "#065f46" :
                  ["pending", "processing"].includes(s) ? "#92400e" :
                  ["failed", "cancelled"].includes(s) ? "#991b1b" : "#374151";
    return <span style={{ background: bg, color: color, padding: "2px 8px", borderRadius: 12, fontSize: 12, fontWeight: 500, textTransform: "capitalize" }}>{s}</span>;
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 700, color: "#111827" }}>
        Order Management ({total})
      </h1>
      
      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, padding: "16px", background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Order Status</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Payment Status</label>
          <select value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setPage(0); }} style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="authorized">Authorized</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading orders...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Order #</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Customer</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Amount</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Status</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Shipper</th>
                  <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>No orders found</td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "16px", fontSize: 14 }}>
                        <div style={{ fontWeight: 600, color: "#111827" }}>{order.orderNumber}</div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>{new Date(order.createdAt).toLocaleString()}</div>
                      </td>
                      <td style={{ padding: "16px", fontSize: 14 }}>
                        <div>{order.customerFirstName} {order.customerLastName}</div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>{order.customerEmail}</div>
                      </td>
                      <td style={{ padding: "16px", fontSize: 14, fontWeight: 500 }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(order.totalAmount)}
                      </td>
                      <td style={{ padding: "16px", fontSize: 14 }}>
                        <div style={{ display: "flex", gap: 6, flexDirection: "column", alignItems: "flex-start" }}>
                          {getStatusBadge(order.orderStatus)}
                          {getStatusBadge(order.paymentStatus)}
                        </div>
                      </td>
                      <td style={{ padding: "16px", fontSize: 14 }}>
                        {order.shipperUserId ? (
                          <div style={{ color: "#10b981", fontWeight: 500, fontSize: 13 }}>● Assigned</div>
                        ) : (
                          <button 
                            onClick={() => setShipperModalOrderId(order.id)}
                            style={{ padding: "4px 8px", fontSize: 12, background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" }}
                          >
                            Assign Shipper
                          </button>
                        )}
                      </td>
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button 
                            onClick={() => setShipperModalOrderId(order.id)}
                            style={{ padding: "6px 10px", fontSize: 12, background: "#fff", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", color: "#4b5563" }}
                          >
                            Dispatch
                          </button>
                          <button 
                            onClick={() => {
                              setOverrideModalOrderId(order.id);
                              setOverrideModalStatus(order.orderStatus);
                              setOverrideModalPayment(order.paymentStatus);
                            }}
                            style={{ padding: "6px 10px", fontSize: 12, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 4, cursor: "pointer", color: "#991b1b" }}
                          >
                            Override
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        <div style={{ padding: 16, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, color: "#6b7280" }}>
            Showing {page * 20 + 1}-{Math.min((page + 1) * 20, total)} of {total}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              disabled={page === 0} 
              onClick={() => setPage(p => p - 1)}
              style={{ padding: "6px 12px", border: "1px solid #d1d5db", background: page === 0 ? "#f9fafb" : "#fff", borderRadius: 6, cursor: page === 0 ? "not-allowed" : "pointer" }}
            >
              Previous
            </button>
            <button 
              disabled={(page + 1) * 20 >= total}
              onClick={() => setPage(p => p + 1)}
              style={{ padding: "6px 12px", border: "1px solid #d1d5db", background: (page + 1) * 20 >= total ? "#f9fafb" : "#fff", borderRadius: 6, cursor: (page + 1) * 20 >= total ? "not-allowed" : "pointer" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <AssignShipperModal 
        orderId={shipperModalOrderId} 
        onClose={() => setShipperModalOrderId(null)} 
        onAssigned={() => { setShipperModalOrderId(null); fetchOrders(); }} 
      />

      <StatusOverrideModal 
        orderId={overrideModalOrderId}
        currentStatus={overrideModalStatus}
        currentPaymentPath={overrideModalPayment}
        onClose={() => setOverrideModalOrderId(null)}
        onUpdated={() => { setOverrideModalOrderId(null); fetchOrders(); }}
      />
    </div>
  );
}
