"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

type Coupon = {
  id: number;
  code: string;
  title: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  expires_at: string | null;
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    min_order_amount: "",
    usage_limit: "",
    expires_at: "",
  });

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/admin-coupons", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load coupons");
      }
      setCoupons(Array.isArray(data?.content) ? data.content : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load coupons";
      toast.error(message);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/admin-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          title: form.title,
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          min_order_amount: Number(form.min_order_amount || 0),
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          expires_at: form.expires_at || null,
          is_active: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to create coupon");
      }
      toast.success("Coupon created");
      setForm({
        code: "",
        title: "",
        discount_type: "percentage",
        discount_value: "",
        min_order_amount: "",
        usage_limit: "",
        expires_at: "",
      });
      await fetchCoupons();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create coupon";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCoupon = async (coupon: Coupon) => {
    try {
      const response = await fetch("/api/auth/admin-coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: coupon.id, is_active: !coupon.is_active }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update coupon");
      }
      toast.success(`Coupon ${coupon.is_active ? "disabled" : "enabled"}`);
      await fetchCoupons();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update coupon";
      toast.error(message);
    }
  };

  return (
    <section style={{ maxWidth: 1100, margin: "30px auto", padding: "0 16px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Admin Coupons</h1>
        <Link href="/admin" style={{ textDecoration: "underline" }}>Back to Admin</Link>
      </div>

      <form
        onSubmit={handleCreate}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginTop: 18,
          padding: 14,
          border: "1px solid #d7d7d7",
          borderRadius: 10,
        }}
      >
        <input placeholder="Code (WELCOME10)" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} required />
        <input placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
        <select value={form.discount_type} onChange={(e) => setForm((p) => ({ ...p, discount_type: e.target.value as "percentage" | "fixed" }))}>
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed</option>
        </select>
        <input type="number" step="0.01" min="0.01" placeholder="Discount value" value={form.discount_value} onChange={(e) => setForm((p) => ({ ...p, discount_value: e.target.value }))} required />
        <input type="number" step="0.01" min="0" placeholder="Min order amount" value={form.min_order_amount} onChange={(e) => setForm((p) => ({ ...p, min_order_amount: e.target.value }))} />
        <input type="number" min="0" placeholder="Usage limit" value={form.usage_limit} onChange={(e) => setForm((p) => ({ ...p, usage_limit: e.target.value }))} />
        <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))} />
        <button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Coupon"}</button>
      </form>

      <div style={{ marginTop: 20, border: "1px solid #d7d7d7", borderRadius: 10, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 10 }}>Code</th>
              <th style={{ textAlign: "left", padding: 10 }}>Type</th>
              <th style={{ textAlign: "left", padding: 10 }}>Value</th>
              <th style={{ textAlign: "left", padding: 10 }}>Min Order</th>
              <th style={{ textAlign: "left", padding: 10 }}>Usage</th>
              <th style={{ textAlign: "left", padding: 10 }}>Status</th>
              <th style={{ textAlign: "left", padding: 10 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 12 }}>Loading coupons...</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 12 }}>No coupons yet.</td></tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>{coupon.code}</td>
                  <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>{coupon.discount_type}</td>
                  <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>{coupon.discount_value}</td>
                  <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>${Number(coupon.min_order_amount || 0).toFixed(2)}</td>
                  <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>{coupon.usage_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}</td>
                  <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>{coupon.is_active ? "Active" : "Inactive"}</td>
                  <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>
                    <button type="button" onClick={() => void toggleCoupon(coupon)}>
                      {coupon.is_active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
