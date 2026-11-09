"use client";

import { useCallback, useEffect, useState } from "react";
import { getUser } from "@/lib/auth";
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

type TransactionPage = {
  content: Transaction[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export default function SellerFinancePage() {
  const token = getUser();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [txPage, setTxPage] = useState<TransactionPage | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const loadBalance = useCallback(async () => {
    if (!token) return;
    const res = await fetch("/api/v1/seller/finance/balance", {
      headers: { }});
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load balance");
    setBalance(data.data);
  }, []);

  const loadTransactions = useCallback(async (page = 0) => {
    if (!token) return;
    const res = await fetch(`/api/v1/seller/finance/transactions?page=${page}&size=20`, {
      headers: { }});
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load transactions");
    const pageData: TransactionPage = data.data;
    setTxPage(pageData);
    if (page === 0) {
      setTransactions(pageData.content);
    } else {
      setTransactions((prev) => [...prev, ...pageData.content]);
    }
    setCurrentPage(page);
  }, []);

  const loadData = useCallback(async () => {
    try {
      await Promise.all([loadBalance(), loadTransactions(0)]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load finance data");
    } finally {
      setLoading(false);
    }
  }, [loadBalance, loadTransactions]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadTransactions(currentPage + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load more transactions");
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = txPage ? currentPage + 1 < txPage.totalPages : false;

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ height: 52, background: "#e5e5e5", borderRadius: 5, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 110, background: "#e5e5e5", borderRadius: 5 }} />)}
        </div>
        <div style={{ height: 400, background: "#e5e5e5", borderRadius: 5 }} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={titleStyle}>Finance</h1>
        </div>
        <button type="button" onClick={() => { setLoading(true); void loadData(); }} style={refreshBtnStyle}>
          ↻ Refresh
        </button>
      </div>

      {/* Balance cards */}
      {balance && (
        <div style={balanceGridStyle}>
          <div style={{ ...balanceCardStyle, borderTop: "3px solid #22c55e" }}>
            <div style={balanceLabelStyle}>Available Balance</div>
            <div style={{ ...balanceValueStyle, color: "#22c55e" }}>
              {balance.currency} {balance.availableBalance.toFixed(2)}
            </div>
            <div style={balanceNoteStyle}>Ready to withdraw</div>
          </div>
          <div style={{ ...balanceCardStyle, borderTop: "3px solid #f59e0b" }}>
            <div style={balanceLabelStyle}>Pending Balance</div>
            <div style={{ ...balanceValueStyle, color: "#f59e0b" }}>
              {balance.currency} {balance.pendingBalance.toFixed(2)}
            </div>
            <div style={balanceNoteStyle}>Awaiting settlement</div>
          </div>
          <div style={{ ...balanceCardStyle, borderTop: "3px solid #171717" }}>
            <div style={balanceLabelStyle}>Total Earned (All Time)</div>
            <div style={{ ...balanceValueStyle, color: "#171717" }}>
              {balance.currency} {balance.totalEarned.toFixed(2)}
            </div>
            <div style={balanceNoteStyle}>Lifetime earnings</div>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#171717" }}>Transaction History</h2>
          {txPage && (
            <span style={{ color: "#737373", fontSize: 13 }}>
              Showing {transactions.length} of {txPage.totalElements}
            </span>
          )}
        </div>

        <div style={tableWrapperStyle}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Date & Time", "Type", "Description", "Gross", "Commission", "Net"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "24px 16px", color: "#737373" }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
                      <div style={{ fontWeight: 600 }}>No transactions yet</div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} style={{ background: "#fff" }}>
                      <td style={tdStyle}>
                        <div style={{ color: "#171717", fontWeight: 500, fontSize: 13 }}>
                          {new Date(tx.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={getTypeBadge(tx.type)}>{tx.type.replace(/_/g, " ")}</span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ color: "#404040" }}>{tx.description}</div>
                        {tx.orderNumber && (
                          <div style={{ color: "#737373", fontSize: 12, marginTop: 2 }}>
                            Order: {tx.orderNumber}
                          </div>
                        )}
                        {tx.productId && (
                          <div style={{ color: "#737373", fontSize: 12 }}>
                            Product: {tx.productId}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>${tx.grossAmount.toFixed(2)}</td>
                      <td style={tdStyle}>${tx.commissionAmount.toFixed(2)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: tx.netAmount < 0 ? "#ef4444" : "#166534" }}>
                        {tx.netAmount > 0 ? "+" : ""}{tx.netAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div style={{ padding: "16px 20px", borderTop: "1px solid #f5f5f4", textAlign: "center" }}>
              <button
                type="button"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
                style={{ background: "#171717", color: "#fff", border: "none", borderRadius: 5, padding: "11px 28px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                {loadingMore ? "Loading…" : "Load More Transactions"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getTypeBadge(type: string): CSSProperties {
  const base: CSSProperties = { padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "uppercase", display: "inline-block" };
  if (type === "ORDER_INCOME") return { ...base, background: "#dcfce7", color: "#166534" };
  if (type === "COMMISSION") return { ...base, background: "#fef9c3", color: "#854d0e" };
  if (type === "REFUND") return { ...base, background: "#fee2e2", color: "#991b1b" };
  return { ...base, background: "#f5f5f4", color: "#404040" };
}

const containerStyle: CSSProperties = { padding: "24px", maxWidth: 1200, margin: "0 auto" };
const pageHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 18 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 22, fontWeight: 600, color: "#171717", letterSpacing: "-0.02em" };
const refreshBtnStyle: CSSProperties = { background: "#fff", border: "1px solid #e5e5e5", borderRadius: 5, padding: "10px 18px", color: "#737373", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const balanceGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 };
const balanceCardStyle: CSSProperties = { background: "#fff", borderRadius: 5, padding: "24px", boxShadow: "none", borderTop: "3px solid #e5e5e5" };
const balanceLabelStyle: CSSProperties = { color: "#737373", fontSize: 13, fontWeight: 500, marginBottom: 10 };
const balanceValueStyle: CSSProperties = { fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 };
const balanceNoteStyle: CSSProperties = { color: "#737373", fontSize: 12 };
const tableWrapperStyle: CSSProperties = { background: "#fff", borderRadius: 5, boxShadow: "none", overflow: "hidden", border: "1px solid #e5e5e5" };
const thStyle: CSSProperties = { background: "#fafaf9", padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#737373", borderBottom: "1px solid #e5e5e5" };
const tdStyle: CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #f5f5f4", fontSize: 14, color: "#404040", verticalAlign: "middle" };
