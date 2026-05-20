"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {getUser, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";

type ExpenseRow = {
  id: number;
  amount: number | string;
  currency: string;
  category: string;
  description?: string | null;
  spentOn: string;
  createdAt?: string;
};

type ExpensePagePayload = {
  content: ExpenseRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  pageTotal?: number | string;
};

const CATEGORIES = ["Shopping", "Food", "Transport", "Bills", "Entertainment", "Health", "Other"];

const cardStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
  border: "1px solid #e2e8f0"};

const labelStyle: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 };

const inputStyle: CSSProperties = {
  width: "100%",
  maxWidth: 360,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 14};

const btnPrimary: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14};

const btnGhost: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13};

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      maximumFractionDigits: 2}).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency || "USD"}`;
  }
}

function parseApiEnvelope<T>(raw: unknown): T {
  if (!raw || typeof raw !== "object") throw new Error("Invalid response");
  const o = raw as { success?: boolean; message?: string; data?: T };
  if (o.success === false) {
    throw new Error(o.message || "Request failed");
  }
  if (o.data === undefined || o.data === null) {
    throw new Error(o.message || "No data");
  }
  return o.data;
}

export default function ExpensesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [pageTotal, setPageTotal] = useState(0);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Shopping");
  const [description, setDescription] = useState("");
  const [spentOn, setSpentOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<number | null>(null);

  const authHeaders = useCallback(() => {
    return {
      "Content-Type": "application/json"};
  }, []);

  const load = useCallback(async () => {
    if (!token) {
      router.replace("/login?returnTo=/expenses");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/me/expenses?page=0&size=100", {
        method: "GET",
        credentials: "include",
        headers: authHeaders(),
        cache: "no-store"});
      const json = await res.json();
      if (!res.ok) {
        throw new Error((json as { message?: string })?.message || "Failed to load expenses");
      }
      const data = parseApiEnvelope<ExpensePagePayload>(json);
      setRows(Array.isArray(data.content) ? data.content : []);
      setTotalElements(Number(data.totalElements ?? 0));
      setPageTotal(Number(data.pageTotal ?? 0));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, router]);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login?returnTo=/expenses");
      return;
    }
    void load();
    return subscribeToAuthChanges(() => {
      if (!getUser()) router.replace("/login?returnTo=/expenses");
      else void load();
    });
  }, [load, router]);

  const resetForm = () => {
    setAmount("");
    setCategory("Shopping");
    setDescription("");
    setSpentOn(new Date().toISOString().slice(0, 10));
    setEditingId(null);
  };

  const startEdit = (row: ExpenseRow) => {
    setEditingId(row.id);
    setAmount(String(row.amount));
    setCategory(row.category);
    setDescription(row.description || "");
    setSpentOn(row.spentOn?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  };

  const submit = async () => {
    if (!token) return;
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Enter a valid amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      if (editingId != null) {
        const res = await fetch(`/api/me/expenses/${editingId}`, {
          method: "PUT",
          credentials: "include",
          headers: authHeaders(),
          body: JSON.stringify({
            amount: num,
            currency: "USD",
            category: category.trim() || "Other",
            description: description.trim() || null,
            spentOn})});
        const json = await res.json();
        if (!res.ok) throw new Error((json as { message?: string })?.message || "Update failed");
        parseApiEnvelope(json);
        toast.success("Expense updated");
      } else {
        const res = await fetch("/api/me/expenses", {
          method: "POST",
          credentials: "include",
          headers: authHeaders(),
          body: JSON.stringify({
            amount: num,
            currency: "USD",
            category: category.trim() || "Other",
            description: description.trim() || undefined,
            spentOn: spentOn || undefined})});
        const json = await res.json();
        if (!res.ok) throw new Error((json as { message?: string })?.message || "Save failed");
        parseApiEnvelope(json);
        toast.success("Expense saved");
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      const res = await fetch(`/api/me/expenses/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: authHeaders()});
      const json = await res.json();
      if (!res.ok) throw new Error((json as { message?: string })?.message || "Delete failed");
      if ((json as { success?: boolean }).success === false) {
        throw new Error((json as { message?: string }).message || "Delete failed");
      }
      toast.success("Deleted");
      if (editingId === id) resetForm();
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const grandHint = useMemo(() => {
    if (rows.length === 0) return "—";
    const sum = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    return formatMoney(sum, rows[0]?.currency || "USD");
  }, [rows]);

  if (loading) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 16px", minHeight: "50vh" }}>
        Loading expenses…
      </main>
    );
  }

  return (
    <main style={{ background: "#f8fafc", minHeight: "72vh", padding: "32px 16px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>Expense management</h1>
            <p style={{ margin: "8px 0 0", color: "#64748b", maxWidth: 560 }}>
              Track spending outside of orders—groceries, subscriptions, or anything you want to budget for. Only you can
              see these entries.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/dashboard" style={{ ...btnGhost, textDecoration: "none", color: "#0f172a", display: "inline-flex", alignItems: "center" }}>
              Dashboard
            </Link>
            <Link href="/orders" style={{ ...btnGhost, textDecoration: "none", color: "#0f172a", display: "inline-flex", alignItems: "center" }}>
              Order history
            </Link>
          </div>
        </div>

        <section style={cardStyle}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#0f172a" }}>{editingId != null ? "Edit expense" : "Add expense"}</h2>
          <div style={{ display: "grid", gap: 14, maxWidth: 480 }}>
            <div>
              <label style={labelStyle}>Amount (USD)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={inputStyle}
                placeholder="0.00"
              />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Note (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ ...inputStyle, maxWidth: "100%", minHeight: 72, resize: "vertical" }}
                placeholder="What was this for?"
              />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={btnPrimary} disabled={saving} onClick={() => void submit()}>
                {saving ? "Saving…" : editingId != null ? "Update" : "Save expense"}
              </button>
              {editingId != null ? (
                <button type="button" style={btnGhost} disabled={saving} onClick={resetForm}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Your entries</h2>
            <div style={{ fontSize: 14, color: "#475569" }}>
              <strong>{totalElements}</strong> total · this page sum <strong>{formatMoney(pageTotal, "USD")}</strong> ·
              loaded list <strong>{grandHint}</strong>
            </div>
          </div>

          {rows.length === 0 ? (
            <p style={{ color: "#64748b", margin: 0 }}>No expenses yet. Add your first row above.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "10px 8px" }}>Date</th>
                    <th style={{ padding: "10px 8px" }}>Category</th>
                    <th style={{ padding: "10px 8px" }}>Note</th>
                    <th style={{ padding: "10px 8px" }}>Amount</th>
                    <th style={{ padding: "10px 8px" }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{row.spentOn}</td>
                      <td style={{ padding: "10px 8px" }}>{row.category}</td>
                      <td style={{ padding: "10px 8px", color: "#475569", maxWidth: 280 }}>{row.description || "—"}</td>
                      <td style={{ padding: "10px 8px", fontWeight: 600 }}>{formatMoney(Number(row.amount), row.currency || "USD")}</td>
                      <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                        <button type="button" style={{ ...btnGhost, marginRight: 8 }} onClick={() => startEdit(row)}>
                          Edit
                        </button>
                        <button type="button" style={{ ...btnGhost, color: "#b91c1c", borderColor: "#fecaca" }} onClick={() => void remove(row.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
