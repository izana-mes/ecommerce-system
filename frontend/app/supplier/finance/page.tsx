"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import toast from "react-hot-toast";
import { CSSProperties } from "react";

type Balance = {
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  currency: string;
};

type Transaction = {
  id: number;
  orderNumber: string;
  productId: string;
  type: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  description: string;
  createdAt: string;
};

export default function SupplierFinancePage() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const [balRes, txRes] = await Promise.all([
        fetch("/api/v1/supplier/finance/balance", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/v1/supplier/finance/transactions?size=50", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const balData = await balRes.json();
      const txData = await txRes.json();

      if (!balRes.ok) throw new Error(balData?.message || "Failed to load balance");
      if (!txRes.ok) throw new Error(txData?.message || "Failed to load transactions");

      setBalance(balData.data);
      setTransactions(txData.data.content);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) return <div style={containerStyle}>Loading finance records...</div>;

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Financial Management</h1>
      
      {balance && (
        <div style={gridStyle}>
          <div style={cardStyle}>
            <div style={cardLabel}>Available Balance</div>
            <div style={cardValue}>${balance.availableBalance.toFixed(2)}</div>
          </div>
          <div style={cardStyle}>
            <div style={cardLabel}>Total Earned (All Time)</div>
            <div style={cardValue}>${balance.totalEarned.toFixed(2)}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <h2 style={sectionTitleStyle}>Recent Transactions</h2>
        <div style={tableContainer}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Date & Time</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Gross</th>
                <th style={thStyle}>Commission</th>
                <th style={thStyle}>Net</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={6} style={tdStyle}>No transactions found.</td></tr>
              ) : transactions.map(tx => (
                <tr key={tx.id}>
                  <td style={tdStyle}>{new Date(tx.createdAt).toLocaleString()}</td>
                  <td style={tdStyle}>
                    <span style={getTypeStyle(tx.type)}>{tx.type.replace("_", " ")}</span>
                  </td>
                  <td style={tdStyle}>
                    {tx.description}
                    {tx.orderNumber && <div style={mutedStyle}>Order: {tx.orderNumber}</div>}
                    {tx.productId && <div style={mutedStyle}>Product: {tx.productId}</div>}
                  </td>
                  <td style={tdStyle}>${tx.grossAmount.toFixed(2)}</td>
                  <td style={tdStyle}>${tx.commissionAmount.toFixed(2)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: tx.netAmount < 0 ? "#ef4444" : "#166534" }}>
                    {tx.netAmount > 0 ? "+" : ""}{tx.netAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getTypeStyle(type: string): CSSProperties {
  const base = { padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const };
  if (type === "ORDER_INCOME") return { ...base, background: "#dcfce7", color: "#166534" };
  if (type === "COMMISSION") return { ...base, background: "#fef9c3", color: "#854d0e" };
  if (type === "REFUND") return { ...base, background: "#fee2e2", color: "#991b1b" };
  return { ...base, background: "#f3f4f6", color: "#374151" };
}

const containerStyle: CSSProperties = { padding: "40px", maxWidth: 1200, margin: "0 auto", animation: "pageIn 400ms ease" };
const titleStyle: CSSProperties = { margin: "0 0 24px", fontSize: 28 };
const sectionTitleStyle: CSSProperties = { margin: "0 0 16px", fontSize: 20 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 };
const cardStyle: CSSProperties = { background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" };
const cardLabel: CSSProperties = { color: "#6b7280", fontSize: 14, fontWeight: 500 };
const cardValue: CSSProperties = { color: "#111827", fontSize: 36, fontWeight: 700, marginTop: 8 };
const tableContainer: CSSProperties = { background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: CSSProperties = { background: "#f9fafb", padding: "12px 24px", textAlign: "left", fontSize: 13, textTransform: "uppercase", color: "#6b7280", borderBottom: "1px solid #e5e7eb" };
const tdStyle: CSSProperties = { padding: "16px 24px", borderBottom: "1px solid #e5e7eb", fontSize: 14 };
const mutedStyle: CSSProperties = { color: "#6b7280", fontSize: 13, marginTop: 4 };
