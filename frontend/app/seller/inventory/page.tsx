"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {getUser, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";

type InventoryItem = {
  productId: string;
  productName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  lowStock: boolean;
  active: boolean;
  sourceType?: "SELLER_OWNED" | "SUPPLIER_RESALE";
  supplierName?: string;
  allocatedQuantity?: number;
  soldQuantity?: number;
  reservedQuantity?: number;
  remainingQuantity?: number;
};

type EditMap = Record<string, string>; // productId → input value

export default function SellerInventoryPage() {
  const router = useRouter();
  const token = getUser();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMap, setEditMap] = useState<EditMap>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [filterMode, setFilterMode] = useState<"all" | "low" | "out">("all");
  const [search, setSearch] = useState("");
  const bulkSaveRef = useRef(false);

  /* ── Auth guard ─────────────────────────────────────────── */
  const syncUser = useCallback(() => {
    const u = getUser();
    if (!u) { router.replace("/login?returnTo=/seller/inventory"); return; }
    if (u.role !== "seller" && u.role !== "admin") { router.replace("/profile"); }
  }, [router]);

  useEffect(() => {
    syncUser();
    return subscribeToAuthChanges(syncUser);
  }, [syncUser]);

  /* ── Fetch ──────────────────────────────────────────────── */
  const fetchInventory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/seller/inventory?lowStockThreshold=${threshold}`, {
        headers: { }});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load inventory");
      const fetched: InventoryItem[] = data.data || [];
      setItems(fetched);
      // Seed edit map with current quantities
      const map: EditMap = {};
      fetched.forEach(i => { map[i.productId] = String(i.stockQuantity); });
      setEditMap(map);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  useEffect(() => { void fetchInventory(); }, [fetchInventory]);

  /* ── Filtered view ──────────────────────────────────────── */
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

  /* ── Single update ──────────────────────────────────────── */
  const saveOne = async (productId: string) => {
    const raw = editMap[productId];
    const qty = parseInt(raw ?? "", 10);
    if (isNaN(qty) || qty < 0) { toast.error("Enter a valid non-negative number"); return; }
    if (!token) return;
    setSaving(prev => ({ ...prev, [productId]: true }));
    try {
      const res = await fetch(`/api/v1/seller/inventory/${productId}/stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ productId, newQuantity: qty, lowStockThreshold: threshold })});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Update failed");
      toast.success(`${productId} stock updated to ${qty}`);
      setItems(prev => prev.map(i => i.productId === productId ? { ...data.data, stockQuantity: qty } : i));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(prev => ({ ...prev, [productId]: false }));
    }
  };

  /* ── Bulk save ──────────────────────────────────────────── */
  const saveAll = async () => {
    if (bulkSaveRef.current) return;
    bulkSaveRef.current = true;
    setBulkSaving(true);

    const updates = Object.entries(editMap)
      .map(([productId, raw]) => ({ productId, newQuantity: parseInt(raw, 10), lowStockThreshold: threshold }))
      .filter(u => !isNaN(u.newQuantity) && u.newQuantity >= 0);
    const ownedUpdates = updates.filter(u => items.find(i => i.productId === u.productId)?.sourceType !== "SUPPLIER_RESALE");
    if (ownedUpdates.length === 0) {
      toast("Supplier resale inventory is controlled by the Supplier; there are no Seller-owned stock changes to save.");
      setBulkSaving(false);
      bulkSaveRef.current = false;
      return;
    }
    if (!token) { setBulkSaving(false); bulkSaveRef.current = false; return; }

    try {
      const res = await fetch("/api/v1/seller/inventory/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ updates: ownedUpdates })});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Bulk update failed");
      toast.success(data?.message || `Updated ${updates.length} products`);
      await fetchInventory();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBulkSaving(false);
      bulkSaveRef.current = false;
    }
  };

  /* ── Export CSV ─────────────────────────────────────────── */
  const exportCsv = () => {
    const header = "Product ID,Product Name,Stock Quantity,Low Stock,Active";
    const rows = items.map(i =>
      [i.productId, `"${i.productName}"`, i.stockQuantity, i.lowStock, i.active].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Stats ──────────────────────────────────────────────── */
  const totalItems = items.length;
  const lowStockCount = items.filter(i => i.lowStock && i.stockQuantity > 0).length;
  const outOfStockCount = items.filter(i => i.stockQuantity === 0).length;
  const totalUnits = items.reduce((s, i) => s + i.stockQuantity, 0);

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ height: 52, background: "#e5e5e5", borderRadius: 5, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 90, background: "#e5e5e5", borderRadius: 5 }} />)}
        </div>
        <div style={{ height: 400, background: "#e5e5e5", borderRadius: 5 }} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={titleStyle}>Inventory</h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={exportCsv} style={outlineButtonStyle}>⬇ Export CSV</button>
          <button type="button" onClick={() => void fetchInventory()} style={outlineButtonStyle}>↻ Refresh</button>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={bulkSaving || !items.some(i => i.sourceType !== "SUPPLIER_RESALE")}
            style={primaryButtonStyle}
          >
            {bulkSaving ? "Saving…" : "Save All Changes"}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={kpiGridStyle}>
        {[
          { label: "Total SKUs", value: totalItems, color: "#171717" },
          { label: "Total Units", value: totalUnits, color: "#171717" },
          { label: "Low Stock", value: lowStockCount, color: "#f59e0b" },
          { label: "Out of Stock", value: outOfStockCount, color: "#ef4444" },
        ].map(k => (
          <div key={k.label} style={kpiCardStyle}>
            <div style={{ color: "#737373", fontSize: 13, fontWeight: 500 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: k.color, marginTop: 6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters & threshold */}
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
              background: filterMode === mode ? "#171717" : "#f5f5f4",
              color: filterMode === mode ? "#fff" : "#737373"}}
          >
            {mode === "all" ? "All" : mode === "low" ? "Low Stock" : "Out of Stock"}
          </button>
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#737373" }}>
          Alert threshold:
          <input
            type="number"
            value={threshold}
            min={1}
            onChange={e => setThreshold(Math.max(1, Number(e.target.value)))}
            style={{ ...filterInputStyle, width: 70, textAlign: "center" }}
          />
        </label>
      </div>

      {/* Table */}
      <div style={tableWrapperStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Product", "Source / Supplier", "Status", "Current Stock", "Allocation", "New Quantity", "Actions"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "48px", color: "#737373" }}>
                    No products match the current filter.
                  </td>
                </tr>
              ) : displayed.map(item => {
                const edited = editMap[item.productId] !== String(item.stockQuantity);
                const qty = parseInt(editMap[item.productId] ?? "", 10);
                const isOut = qty === 0;
                const isLow = !isNaN(qty) && qty > 0 && qty <= threshold;

                return (
                  <tr key={item.productId} style={{ background: isOut ? "#fff5f5" : isLow ? "#fffbeb" : "#fff" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: "#171717" }}>{item.productName}</div>
                      <div style={{ color: "#737373", fontSize: 12, fontFamily: "monospace" }}>{item.productId}</div>
                    </td>
                    <td style={tdStyle}>{item.sourceType === "SUPPLIER_RESALE" ? `Supplier resale · ${item.supplierName || "Supplier"}` : "Seller owned"}</td>
                    <td style={tdStyle}>
                      <span style={{
                        ...badgeBase,
                        background: item.active ? "#dcfce7" : "#f3f4f6",
                        color: item.active ? "#166534" : "#404040"}}>
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: item.stockQuantity === 0 ? "#ef4444" : item.lowStock ? "#f59e0b" : "#171717"}}>
                        {item.stockQuantity}
                      </span>
                      {item.lowStock && item.stockQuantity > 0 && (
                        <span style={{ display: "block", fontSize: 11, color: "#f59e0b", marginTop: 2 }}>Low stock</span>
                      )}
                      {item.stockQuantity === 0 && (
                        <span style={{ display: "block", fontSize: 11, color: "#ef4444", marginTop: 2 }}>Out of stock</span>
                      )}
                    </td>
                    <td style={tdStyle}>{item.sourceType === "SUPPLIER_RESALE" ? `Allocated ${item.allocatedQuantity ?? 0} · Sold ${item.soldQuantity ?? 0} · Reserved ${item.reservedQuantity ?? 0}` : "—"}</td>
                    <td style={tdStyle}>
                      {item.sourceType === "SUPPLIER_RESALE" ? <span style={{ color: "#737373" }}>Supplier managed</span> : <>
                      <input
                        type="number"
                        min={0}
                        value={editMap[item.productId] ?? ""}
                        onChange={e => setEditMap(prev => ({ ...prev, [item.productId]: e.target.value }))}
                        style={{
                          ...qtyInputStyle,
                          borderColor: edited ? "#171717" : "#e5e5e5",
                          boxShadow: edited ? "0 0 0 3px rgba(99,102,241,0.12)" : "none"}}
                      />
                      </>}
                    </td>
                    <td style={tdStyle}>
                      {item.sourceType === "SUPPLIER_RESALE" ? <span style={{ color: "#737373" }}>Supplier controls allocation</span> :
                      <button
                        type="button"
                        onClick={() => void saveOne(item.productId)}
                        disabled={!edited || saving[item.productId]}
                        style={{
                          ...saveButtonStyle,
                          opacity: !edited || saving[item.productId] ? 0.4 : 1,
                          cursor: !edited || saving[item.productId] ? "not-allowed" : "pointer"}}
                      >
                        {saving[item.productId] ? "Saving…" : "Save"}
                      </button>
                      }
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

const containerStyle: CSSProperties = { padding: "24px", maxWidth: 1200, margin: "0 auto" };
const pageHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 18 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 22, fontWeight: 600, color: "#171717", letterSpacing: "-0.02em" };
const kpiGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 };
const kpiCardStyle: CSSProperties = { background: "#fff", borderRadius: 5, padding: "14px 16px", boxShadow: "none", border: "1px solid #e5e5e5" };
const filterInputStyle: CSSProperties = { padding: "9px 14px", borderRadius: 5, border: "1px solid #e5e5e5", fontSize: 14, color: "#171717", background: "#fff", minWidth: 160 };
const pillStyle: CSSProperties = { padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s" };
const primaryButtonStyle: CSSProperties = { background: "#171717", color: "#fff", border: "none", borderRadius: 5, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const outlineButtonStyle: CSSProperties = { background: "#fff", color: "#737373", border: "1px solid #e5e5e5", borderRadius: 5, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const tableWrapperStyle: CSSProperties = { background: "#fff", borderRadius: 5, boxShadow: "none", overflow: "hidden", border: "1px solid #e5e5e5" };
const thStyle: CSSProperties = { background: "#fafaf9", padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#737373", borderBottom: "1px solid #e5e5e5", whiteSpace: "nowrap" };
const tdStyle: CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #f5f5f4", fontSize: 14, color: "#404040", verticalAlign: "middle" };
const qtyInputStyle: CSSProperties = { width: 100, padding: "8px 12px", borderRadius: 5, border: "1.5px solid #e5e5e5", fontSize: 15, fontWeight: 600, color: "#171717", textAlign: "center", transition: "border-color 0.15s, box-shadow 0.15s" };
const saveButtonStyle: CSSProperties = { background: "#171717", color: "#fff", border: "none", borderRadius: 5, padding: "8px 16px", fontWeight: 600, fontSize: 13 };
const badgeBase: CSSProperties = { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 };
