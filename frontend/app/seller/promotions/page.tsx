"use client";

import { CSSProperties, useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";

type InventoryItem = {
  productId: string;
  productName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  lowStock: boolean;
  active: boolean;
};

type PromoState = Record<string, string>; // productId → salePrice input

export default function SellerPromotionsPage() {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoInput, setPromoInput] = useState<PromoState>({});
  const [applying, setApplying] = useState<Record<string, boolean>>({});
  const [clearing, setClearing] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const fetchProducts = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/seller/inventory", {
        headers: { }});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load products");
      setProducts(data.data || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchProducts(); }, [fetchProducts]);

  const applyPromo = async (productId: string) => {
    const raw = promoInput[productId];
    if (!raw || isNaN(Number(raw)) || Number(raw) <= 0) {
      toast.error("Enter a valid positive sale price");
      return;
    }
    const token = getToken();
    if (!token) return;
    setApplying(prev => ({ ...prev, [productId]: true }));
    try {
      const res = await fetch(`/api/v1/seller/products/${productId}/promotion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ salePrice: Number(raw) })});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to apply promotion");
      toast.success(data?.message || "Promotion applied!");
      setPromoInput(prev => ({ ...prev, [productId]: "" }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to apply promotion");
    } finally {
      setApplying(prev => ({ ...prev, [productId]: false }));
    }
  };

  const clearPromo = async (productId: string) => {
    const token = getToken();
    if (!token) return;
    setClearing(prev => ({ ...prev, [productId]: true }));
    try {
      const res = await fetch(`/api/v1/seller/products/${productId}/promotion`, {
        method: "DELETE",
        headers: { }});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to clear promotion");
      toast.success(data?.message || "Promotion cleared, original price restored");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to clear promotion");
    } finally {
      setClearing(prev => ({ ...prev, [productId]: false }));
    }
  };

  const filtered = search.trim()
    ? products.filter(p =>
        p.productName.toLowerCase().includes(search.toLowerCase()) ||
        p.productId.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ height: 52, background: "#e2e8f0", borderRadius: 12, marginBottom: 24 }} />
        <div style={{ display: "grid", gap: 16 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 100, background: "#e2e8f0", borderRadius: 14 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={titleStyle}>Promotions</h1>
          <p style={subtitleStyle}>Apply limited-time sale prices to your products. The original price is preserved and restored automatically when you end a promotion.</p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search product by name or ID…"
          style={searchStyle}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={emptyStyle}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
          <div style={{ fontWeight: 600 }}>No products found</div>
          <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>Add products to your catalog first.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {filtered.map(product => (
            <div key={product.productId} style={cardStyle}>
              <div style={cardLeftStyle}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{product.productName}</div>
                <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace", marginTop: 2 }}>{product.productId}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ ...badge, background: product.active ? "#dcfce7" : "#f3f4f6", color: product.active ? "#166534" : "#374151" }}>
                    {product.active ? "Active" : "Inactive"}
                  </span>
                  <span style={{ ...badge, background: "#ede9fe", color: "#5b21b6" }}>
                    Stock: {product.stockQuantity}
                  </span>
                </div>
              </div>

              <div style={cardRightStyle}>
                <div style={{ fontSize: 13, color: "#475569", marginBottom: 8, fontWeight: 500 }}>
                  Set a promotional sale price (must be lower than current price):
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={promoInput[product.productId] || ""}
                    onChange={e => setPromoInput(prev => ({ ...prev, [product.productId]: e.target.value }))}
                    placeholder="Sale price"
                    style={priceInputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => void applyPromo(product.productId)}
                    disabled={applying[product.productId]}
                    style={applyButtonStyle}
                  >
                    {applying[product.productId] ? "Applying…" : "🏷️ Apply Promotion"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void clearPromo(product.productId)}
                    disabled={clearing[product.productId]}
                    style={clearButtonStyle}
                  >
                    {clearing[product.productId] ? "Clearing…" : "✕ End Promotion"}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8, margin: "8px 0 0" }}>
                  Ending a promotion restores the original price from before the sale.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = { padding: "36px 32px", maxWidth: 1200, margin: "0 auto" };
const pageHeaderStyle: CSSProperties = { marginBottom: 24 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" };
const subtitleStyle: CSSProperties = { margin: "8px 0 0", color: "#64748b", fontSize: 14, maxWidth: 600, lineHeight: 1.6 };
const searchStyle: CSSProperties = { width: "100%", maxWidth: 400, padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, color: "#0f172a", background: "#fff" };
const cardStyle: CSSProperties = { background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px 24px", display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" };
const cardLeftStyle: CSSProperties = { flex: "0 0 260px", minWidth: 200 };
const cardRightStyle: CSSProperties = { flex: 1, minWidth: 280 };
const badge: CSSProperties = { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 };
const priceInputStyle: CSSProperties = { width: 120, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 15, fontWeight: 600, color: "#0f172a" };
const applyButtonStyle: CSSProperties = { background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const clearButtonStyle: CSSProperties = { background: "#fff", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const emptyStyle: CSSProperties = { textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 16, border: "1px dashed #e2e8f0", color: "#64748b" };
