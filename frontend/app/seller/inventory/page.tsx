"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";
import { CSSProperties } from "react";

type InventoryItem = {
  productId: string;
  productName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  lowStock: boolean;
  active: boolean;
};

type EditingState = { productId: string; value: string };

export default function SellerInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(5);
  const [thresholdInput, setThresholdInput] = useState("5");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchInventory = useCallback(async (lowStockThreshold = 5) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/seller/inventory?lowStockThreshold=${lowStockThreshold}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load inventory");
      setItems(data.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchInventory(threshold); }, [fetchInventory, threshold]);

  useEffect(() => { if (editing) setTimeout(() => inputRef.current?.focus(), 50); }, [editing]);

  const startEdit = (item: InventoryItem) =>
    setEditing({ productId: item.productId, value: String(item.stockQuantity) });
  const cancelEdit = () => setEditing(null);

  const commitEdit = async () => {
    if (!editing) return;
    const qty = parseInt(editing.value, 10);
    if (isNaN(qty) || qty < 0) { toast.error("Enter a valid non-negative number"); return; }
    const token = getToken();
    if (!token) return;
    const saved = editing;
    setEditing(null);
    setUpdatingId(saved.productId);
    try {
      const res = await fetch(`/api/v1/seller/inventory/${saved.productId}/stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: saved.productId, newQuantity: qty, lowStockThreshold: threshold }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update stock");
      toast.success("Stock updated");
      setItems((prev) => prev.map((i) => i.productId === saved.productId ? data.data : i));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update stock");
    } finally {
      setUpdatingId(null);
    }
  };

  const applyThreshold = () => {
    const val = parseInt(thresholdInput, 10);
    if (isNaN(val) || val < 1) { toast.error("Threshold must be >= 1"); return; }
    setThreshold(val);
    setLoading(true);
    void fetchInventory(val);
  };

  const lowStockItems = items.filter((i) => i.lowStock);

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ height: 52, background: "#e2e8f0", borderRadius: 12, marginBottom: 24 }} />
        <div style={{ height: 400, background: "#e2e8f0", borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={titleStyle}>Inventory Management</h1>
          <p style={subtitleStyle}>Monitor and update stock levels for your products</p>
        </div>
        <button type="button" onClick={() => { setLoading(true); void fetchInventory(threshold); }} style={refreshBtnStyle}>
          ↻ Refresh
        </button>
      </div>

      <div style={summaryGridStyle}>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Total Products</div>
          <div style={summaryValueStyle}>{items.length}</div>
        </div>
        <div style={{ ...summaryCardStyle, borderTop: "3px solid #22c55e" }}>
          <div style={summaryLabelStyle}>Active</div>
          <div style={{ ...summaryValueStyle, color: "#22c55e" }}>{items.filter((i) => i.active).length}</div>
        </div>
        <div style={{ ...summaryCardStyle, borderTop: "3px solid #ef4444" }}>
          <div style={summaryLabelStyle}>Low Stock</div>
          <div style={{ ...summaryValueStyle, color: "#ef4444" }}>{lowStockItems.length}</div>
        </div>
        <div style={{ ...summaryCardStyle, borderTop: "3px solid #6366f1" }}>
          <div style={summaryLabelStyle}>Low-Stock Threshold</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <input type="number" min={1} value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyThreshold()}
              style={{ width: 60, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, fontWeight: 600 }} />
            <button type="button" onClick={applyThreshold}
              style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Apply
            </button>
          </div>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 18px", color: "#92400e", fontSize: 14, marginBottom: 20 }}>
          ⚠️ <strong>{lowStockItems.length}</strong> product{lowStockItems.length !== 1 ? "s" : ""} below threshold ({threshold} units):{" "}
          {lowStockItems.map((i) => i.productName).join(", ")}
        </div>
      )}

      <div style={tableWrapperStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Product", "Status", "Stock Quantity", "Actions"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                <div style={{ fontWeight: 600 }}>No products found</div>
              </td></tr>
            ) : items.map((item, idx) => {
              const isEditing = editing?.productId === item.productId;
              const isUpdating = updatingId === item.productId;
              return (
                <tr key={item.productId} style={{ background: item.lowStock ? "rgba(239,68,68,0.04)" : idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{item.productName}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{item.productId}</div>
                  </td>
                  <td style={tdStyle}>
                    {item.active
                      ? <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>● Active</span>
                      : <span style={{ background: "#f1f5f9", color: "#64748b", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>● Inactive</span>}
                  </td>
                  <td style={tdStyle}>
                    {isEditing ? (
                      <input ref={inputRef} type="number" min={0} value={editing.value}
                        onChange={(e) => setEditing({ productId: item.productId, value: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") void commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                        style={{ width: 90, padding: "8px 10px", border: "2px solid #6366f1", borderRadius: 8, fontSize: 15, fontWeight: 600 }} />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: item.lowStock ? "#ef4444" : "#0f172a" }}>{item.stockQuantity}</span>
                        {item.lowStock && <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Low</span>}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => void commitEdit()} disabled={isUpdating}
                          style={{ background: "#22c55e", color: "#fff", padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                          ✓ Save
                        </button>
                        <button type="button" onClick={cancelEdit}
                          style={{ background: "#f1f5f9", color: "#475569", padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                          ✕ Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => startEdit(item)} disabled={isUpdating}
                        style={{ background: "#0f172a", color: "#fff", padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                        {isUpdating ? "Updating…" : "✎ Edit Stock"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = { padding: "36px 32px", maxWidth: 1200, margin: "0 auto" };
const pageHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 28 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" };
const subtitleStyle: CSSProperties = { margin: "6px 0 0", color: "#64748b", fontSize: 14 };
const refreshBtnStyle: CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 18px", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const summaryGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 };
const summaryCardStyle: CSSProperties = { background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", borderTop: "3px solid #e2e8f0" };
const summaryLabelStyle: CSSProperties = { color: "#64748b", fontSize: 13, fontWeight: 500, marginBottom: 8 };
const summaryValueStyle: CSSProperties = { fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" };
const tableWrapperStyle: CSSProperties = { background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)", overflow: "hidden", border: "1px solid #e2e8f0" };
const thStyle: CSSProperties = { background: "#f8fafc", padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", borderBottom: "1px solid #e2e8f0" };
const tdStyle: CSSProperties = { padding: "14px 20px", borderBottom: "1px solid #f1f5f9", fontSize: 14, color: "#334155", verticalAlign: "middle" };
