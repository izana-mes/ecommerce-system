"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";

type InventoryItem = {
  productId: string;
  productName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  lowStock: boolean;
  active: boolean;
};

type RestockForm = { productId: string; quantity: string; note: string } | null;

export default function SupplierInventoryPage() {
  const token = getUser();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMap, setEditMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [restockForm, setRestockForm] = useState<RestockForm>(null);
  const [submittingRestock, setSubmittingRestock] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "low" | "out">("all");
  const [search, setSearch] = useState("");

  const fetchInventory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/supplier/inventory?lowStockThreshold=8", {
        headers: { }});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load inventory");
      const fetched: InventoryItem[] = data.data || [];
      setItems(fetched);
      const map: Record<string, string> = {};
      fetched.forEach(i => { map[i.productId] = String(i.stockQuantity); });
      setEditMap(map);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchInventory(); }, [fetchInventory]);

  const displayed = useMemo(() => {
    let list = items;
    if (filterMode === "low") list = list.filter(i => i.lowStock && i.stockQuantity > 0);
    if (filterMode === "out") list = list.filter(i => i.stockQuantity === 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.productName.toLowerCase().includes(q) || i.productId.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, filterMode, search]);

  const saveOne = async (productId: string) => {
    const qty = parseInt(editMap[productId] ?? "", 10);
    if (isNaN(qty) || qty < 0) { toast.error("Enter a valid non-negative number"); return; }
    if (!token) return;
    setSaving(prev => ({ ...prev, [productId]: true }));
    try {
      const res = await fetch(`/api/v1/supplier/inventory/${productId}/stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ productId, newQuantity: qty })});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Update failed");
      toast.success(`Stock updated to ${qty}`);
      setItems(prev => prev.map(i =>
        i.productId === productId
          ? { ...i, stockQuantity: qty, lowStock: qty <= i.lowStockThreshold }
          : i
      ));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(prev => ({ ...prev, [productId]: false }));
    }
  };

  const submitRestock = async () => {
    if (!restockForm) return;
    const qty = parseInt(restockForm.quantity, 10);
    if (isNaN(qty) || qty < 1) { toast.error("Enter a valid requested quantity (≥ 1)"); return; }
    if (!token) return;
    setSubmittingRestock(true);
    try {
      const res = await fetch("/api/v1/supplier/inventory/restock-request", {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({
          productId: restockForm.productId,
          requestedQuantity: qty,
          note: restockForm.note.trim() || null})});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Restock request failed");
      toast.success(data?.message || "Restock request submitted for admin review");
      setRestockForm(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Restock request failed");
    } finally {
      setSubmittingRestock(false);
    }
  };

  const totalItems = items.length;
  const lowCount = items.filter(i => i.lowStock && i.stockQuantity > 0).length;
  const outCount = items.filter(i => i.stockQuantity === 0).length;
  const totalUnits = items.reduce((s, i) => s + i.stockQuantity, 0);

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ height: 52, background: "#e2e8f0", borderRadius: 12, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 90, background: "#e2e8f0", borderRadius: 14 }} />)}
        </div>
        <div style={{ height: 400, background: "#e2e8f0", borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={titleStyle}>Inventory</h1>
          <p style={subtitleStyle}>Monitor and update stock levels. Flag products for restocking.</p>
        </div>
        <button type="button" onClick={() => void fetchInventory()} style={outlineButtonStyle}>↻ Refresh</button>
      </div>

      {/* KPI cards */}
      <div style={kpiGridStyle}>
        {[
          { label: "Total SKUs", value: totalItems, color: "#0f172a" },
          { label: "Total Units", value: totalUnits, color: "#0f766e" },
          { label: "Low Stock", value: lowCount, color: "#d97706" },
          { label: "Out of Stock", value: outCount, color: "#dc2626" },
        ].map(k => (
          <div key={k.label} style={kpiCardStyle}>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 500 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, marginTop: 6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search product…"
          style={filterInputStyle}
        />
        {(["all", "low", "out"] as const).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilterMode(mode)}
            style={{
              ...pillStyle,
              background: filterMode === mode ? "#0f172a" : "#f1f5f9",
              color: filterMode === mode ? "#fff" : "#475569"}}
          >
            {mode === "all" ? "All" : mode === "low" ? "⚠ Low Stock" : "🚫 Out of Stock"}
          </button>
        ))}
      </div>

      {/* Restock request modal overlay */}
      {restockForm && (
        <div style={overlayStyle} onClick={() => setRestockForm(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
              Restock Request
            </h2>
            <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 20px" }}>
              Submit a formal restock request for <strong>{restockForm.productId}</strong>. Admin will be notified to action this.
            </p>
            <label style={labelStyle}>Units to Restock</label>
            <input
              type="number"
              min="1"
              value={restockForm.quantity}
              onChange={e => setRestockForm(prev => prev ? { ...prev, quantity: e.target.value } : null)}
              placeholder="e.g. 500"
              style={{ ...filterInputStyle, width: "100%", marginBottom: 14 }}
            />
            <label style={labelStyle}>Note for Admin (optional)</label>
            <textarea
              value={restockForm.note}
              onChange={e => setRestockForm(prev => prev ? { ...prev, note: e.target.value } : null)}
              placeholder="e.g. Running critically low, Black Friday approaching…"
              rows={3}
              style={{ ...filterInputStyle, width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 20 }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setRestockForm(null)} style={outlineButtonStyle}>Cancel</button>
              <button
                type="button"
                onClick={() => void submitRestock()}
                disabled={submittingRestock}
                style={tealButtonStyle}
              >
                {submittingRestock ? "Submitting…" : "📦 Submit Restock Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={tableWrapperStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Product", "Status", "Current Stock", "New Quantity", "Actions"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: "center", padding: "48px", color: "#94a3b8" }}>
                    No products match the current filter.
                  </td>
                </tr>
              ) : displayed.map(item => {
                const edited = editMap[item.productId] !== String(item.stockQuantity);
                const qty = parseInt(editMap[item.productId] ?? "", 10);
                const isOut = qty === 0;
                const isLow = !isNaN(qty) && qty > 0 && qty <= item.lowStockThreshold;
                return (
                  <tr key={item.productId} style={{ background: isOut ? "#fff5f5" : isLow ? "#fffbeb" : "#fff" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{item.productName}</div>
                      <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{item.productId}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ ...badge, background: item.active ? "#ccfbf1" : "#f3f4f6", color: item.active ? "#0f766e" : "#374151" }}>
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: item.stockQuantity === 0 ? "#ef4444" : item.lowStock ? "#f59e0b" : "#0f172a" }}>
                        {item.stockQuantity}
                      </span>
                      {item.stockQuantity === 0 && <span style={{ display: "block", fontSize: 11, color: "#ef4444" }}>Out of stock</span>}
                      {item.lowStock && item.stockQuantity > 0 && <span style={{ display: "block", fontSize: 11, color: "#f59e0b" }}>Low stock</span>}
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        min={0}
                        value={editMap[item.productId] ?? ""}
                        onChange={e => setEditMap(prev => ({ ...prev, [item.productId]: e.target.value }))}
                        style={{
                          ...qtyInputStyle,
                          borderColor: edited ? "#14b8a6" : "#e2e8f0",
                          boxShadow: edited ? "0 0 0 3px rgba(20,184,166,0.15)" : "none"}}
                      />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => void saveOne(item.productId)}
                          disabled={!edited || saving[item.productId]}
                          style={{ ...saveButtonStyle, opacity: !edited || saving[item.productId] ? 0.4 : 1, cursor: !edited || saving[item.productId] ? "not-allowed" : "pointer" }}
                        >
                          {saving[item.productId] ? "…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestockForm({ productId: item.productId, quantity: "", note: "" })}
                          style={restockButtonStyle}
                          title="Request stock replenishment from admin"
                        >
                          📦 Restock
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = { padding: "36px 32px", maxWidth: 1200, margin: "0 auto" };
const pageHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 28 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" };
const subtitleStyle: CSSProperties = { margin: "6px 0 0", color: "#64748b", fontSize: 14 };
const kpiGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 };
const kpiCardStyle: CSSProperties = { background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", border: "1px solid #e2e8f0" };
const filterInputStyle: CSSProperties = { padding: "9px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, color: "#0f172a", background: "#fff", minWidth: 160, boxSizing: "border-box" };
const pillStyle: CSSProperties = { padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s" };
const outlineButtonStyle: CSSProperties = { background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const tealButtonStyle: CSSProperties = { background: "#0f766e", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const tableWrapperStyle: CSSProperties = { background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)", overflow: "hidden", border: "1px solid #e2e8f0" };
const thStyle: CSSProperties = { background: "#f8fafc", padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
const tdStyle: CSSProperties = { padding: "14px 20px", borderBottom: "1px solid #f1f5f9", fontSize: 14, color: "#334155", verticalAlign: "middle" };
const qtyInputStyle: CSSProperties = { width: 90, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 15, fontWeight: 600, color: "#0f172a", textAlign: "center", transition: "border-color 0.15s, box-shadow 0.15s" };
const saveButtonStyle: CSSProperties = { background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 13 };
const restockButtonStyle: CSSProperties = { background: "#fff", color: "#0f766e", border: "1.5px solid #99f6e4", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const badge: CSSProperties = { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 };
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 };
const modalStyle: CSSProperties = { background: "#fff", borderRadius: 20, padding: 32, maxWidth: 480, width: "90%", boxShadow: "0 24px 60px rgba(0,0,0,0.2)" };
const labelStyle: CSSProperties = { display: "block", fontWeight: 600, color: "#374151", fontSize: 13, marginBottom: 6 };
