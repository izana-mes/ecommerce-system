"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function SupplierInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/v1/supplier/inventory", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await response.json();
      if (!response.ok) throw new Error(res?.message || "Failed to load inventory");
      setItems(res.data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  const handleUpdateStock = async (productId: string, current: number) => {
    const input = prompt("Enter new stock quantity:", current.toString());
    if (input === null) return;
    
    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty < 0) {
      toast.error("Valid positive number is required");
      return;
    }

    const token = getToken();
    if (!token) return;

    setUpdatingId(productId);
    try {
      const response = await fetch(`/api/v1/supplier/inventory/${productId}/stock`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newQuantity: qty }),
      });
      const res = await response.json();
      if (!response.ok) throw new Error(res?.message || "Failed to update stock");
      
      toast.success("Stock updated");
      setItems(items.map(item => item.productId === productId ? res.data : item));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div style={containerStyle}>Loading inventory...</div>;

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Inventory Management</h1>
      
      <div style={tableContainer}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Current Stock</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} style={tdStyle}>No products found.</td></tr>
            ) : items.map(item => (
              <tr key={item.productId} style={{ background: item.lowStock ? "#fef2f2" : "transparent" }}>
                <td style={tdStyle}>
                  <strong>{item.productName}</strong><br/>
                  <span style={mutedStyle}>{item.productId}</span>
                </td>
                <td style={tdStyle}>
                  {item.active 
                    ? <span style={badgeActive}>Active</span>
                    : <span style={badgeInactive}>Inactive</span>}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: item.lowStock ? "#ef4444" : "#111827" }}>
                      {item.stockQuantity}
                    </span>
                    {item.lowStock && <span style={{ fontSize: 12, color: "#ef4444" }}>(Low Stock)</span>}
                  </div>
                </td>
                <td style={tdStyle}>
                  <button 
                    onClick={() => handleUpdateStock(item.productId, item.stockQuantity)}
                    disabled={updatingId === item.productId}
                    style={buttonStyle}
                  >
                    {updatingId === item.productId ? "Updating..." : "Update Stock"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = { padding: "40px", maxWidth: 1200, margin: "0 auto", animation: "pageIn 400ms ease" };
const titleStyle: CSSProperties = { margin: "0 0 24px", fontSize: 28 };
const tableContainer: CSSProperties = { background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: CSSProperties = { background: "#f9fafb", padding: "12px 24px", textAlign: "left", fontSize: 13, textTransform: "uppercase", color: "#6b7280", borderBottom: "1px solid #e5e7eb" };
const tdStyle: CSSProperties = { padding: "16px 24px", borderBottom: "1px solid #e5e7eb", fontSize: 14 };
const mutedStyle: CSSProperties = { color: "#6b7280", fontSize: 13 };
const badgeActive: CSSProperties = { background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 500 };
const badgeInactive: CSSProperties = { background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 500 };
const buttonStyle: CSSProperties = { background: "#0f172a", color: "#fff", padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 };
