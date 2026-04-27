"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

import { getToken } from "@/lib/auth";

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
  assigned_count?: number;
  acknowledged_count?: number;
  used_assignment_count?: number;
};

type Customer = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  active: boolean;
};

type AdminUsersResponse = {
  data?: {
    content?: Array<{
      id?: string;
      email?: string;
      firstName?: string | null;
      lastName?: string | null;
      role?: string;
      active?: boolean;
    }>;
  };
};

export default function AdminCouponsPage() {
  const [token, setToken] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    min_order_amount: "",
    usage_limit: "",
    expires_at: "",
  });

  useEffect(() => {
    setToken(getToken() || "");
  }, []);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/admin-coupons", {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load coupons");
      }
      const nextCoupons = Array.isArray(data?.content) ? data.content as Coupon[] : [];
      setCoupons(nextCoupons);
      setSelectedCouponId((current) => {
        if (current && nextCoupons.some((coupon) => coupon.id === current)) {
          return current;
        }
        return nextCoupons[0]?.id ?? null;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load coupons";
      toast.error(message);
      setCoupons([]);
      setSelectedCouponId(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const response = await fetch("/api/auth/admin?page=0&size=100", {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json() as AdminUsersResponse;
      if (!response.ok) {
        throw new Error((data as { error?: string })?.error || "Failed to load customers");
      }

      const nextCustomers = Array.isArray(data?.data?.content)
        ? data.data!.content!
            .filter((entry) => entry?.role === "user" && entry.email && entry.id && entry.active !== false)
            .map((entry) => ({
              id: String(entry.id),
              email: String(entry.email),
              firstName: entry.firstName ?? null,
              lastName: entry.lastName ?? null,
              role: String(entry.role),
              active: entry.active !== false,
            }))
        : [];

      setCustomers(nextCustomers);
      setSelectedRecipientIds((current) => current.filter((id) => nextCustomers.some((customer) => customer.id === id)));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load customers";
      toast.error(message);
      setCustomers([]);
      setSelectedRecipientIds([]);
    } finally {
      setCustomersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchCoupons();
    void fetchCustomers();
  }, [fetchCoupons, fetchCustomers]);

  const selectedCoupon = useMemo(
    () => coupons.find((coupon) => coupon.id === selectedCouponId) ?? null,
    [coupons, selectedCouponId]
  );

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/admin-coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  const handleIssue = async () => {
    if (!selectedCoupon) {
      toast.error("Choose a coupon to issue");
      return;
    }
    if (selectedRecipientIds.length === 0) {
      toast.error("Choose at least one customer");
      return;
    }

    setIssuing(true);
    try {
      const recipients = selectedRecipientIds
        .map((recipientId) => customers.find((customer) => customer.id === recipientId))
        .filter((customer): customer is Customer => Boolean(customer))
        .map((customer) => ({
          userId: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
        }));

      const response = await fetch("/api/auth/admin-coupons/issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          couponId: selectedCoupon.id,
          recipients,
          notificationTitle,
          notificationMessage,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to issue coupon");
      }

      toast.success(data?.message || "Coupon issued");
      setSelectedRecipientIds([]);
      setNotificationTitle("");
      setNotificationMessage("");
      await fetchCoupons();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to issue coupon";
      toast.error(message);
    } finally {
      setIssuing(false);
    }
  };

  return (
    <section style={{ maxWidth: 1180, margin: "30px auto", padding: "0 16px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Coupons & Discount Vouchers</h1>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
          gap: 20,
          marginTop: 20,
          alignItems: "start",
        }}
      >
        <div style={{ border: "1px solid #d7d7d7", borderRadius: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 10 }}>Code</th>
                <th style={{ textAlign: "left", padding: 10 }}>Title</th>
                <th style={{ textAlign: "left", padding: 10 }}>Value</th>
                <th style={{ textAlign: "left", padding: 10 }}>Usage</th>
                <th style={{ textAlign: "left", padding: 10 }}>Assignments</th>
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
                  <tr key={coupon.id} style={{ background: selectedCouponId === coupon.id ? "#f8fbff" : undefined }}>
                    <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>{coupon.code}</td>
                    <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>{coupon.title}</td>
                    <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}%`
                        : `$${Number(coupon.discount_value).toFixed(2)}`}
                    </td>
                    <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>
                      {coupon.usage_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}
                    </td>
                    <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>
                      {Number(coupon.assigned_count || 0)} issued / {Number(coupon.acknowledged_count || 0)} confirmed
                    </td>
                    <td style={{ padding: 10, borderTop: "1px solid #efefef" }}>{coupon.is_active ? "Active" : "Inactive"}</td>
                    <td style={{ padding: 10, borderTop: "1px solid #efefef", whiteSpace: "nowrap" }}>
                      <button type="button" onClick={() => setSelectedCouponId(coupon.id)} style={{ marginRight: 8 }}>
                        Issue
                      </button>
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

        <aside style={{ border: "1px solid #d7d7d7", borderRadius: 10, padding: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Issue to Customers</h2>
          <p style={{ color: "#555", marginBottom: 12 }}>
            {selectedCoupon
              ? `Selected: ${selectedCoupon.code} (${selectedCoupon.title})`
              : "Choose a coupon from the table first."}
          </p>

          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Recipients</label>
          <select
            multiple
            value={selectedRecipientIds}
            onChange={(event) => {
              const values = Array.from(event.target.selectedOptions).map((option) => option.value);
              setSelectedRecipientIds(values);
            }}
            disabled={customersLoading || customers.length === 0}
            style={{ width: "100%", minHeight: 170, marginBottom: 12 }}
          >
            {customers.map((customer) => {
              const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
              return (
                <option key={customer.id} value={customer.id}>
                  {name ? `${name} - ` : ""}{customer.email}
                </option>
              );
            })}
          </select>

          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Notification Title</label>
          <input
            value={notificationTitle}
            onChange={(event) => setNotificationTitle(event.target.value)}
            placeholder="Optional custom title"
            style={{ width: "100%", marginBottom: 12 }}
          />

          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Notification Message</label>
          <textarea
            value={notificationMessage}
            onChange={(event) => setNotificationMessage(event.target.value)}
            placeholder="Optional custom message"
            rows={5}
            style={{ width: "100%", marginBottom: 12 }}
          />

          <button
            type="button"
            onClick={() => void handleIssue()}
            disabled={!selectedCoupon || issuing || customersLoading || customers.length === 0}
            style={{ width: "100%" }}
          >
            {issuing ? "Issuing..." : `Issue to ${selectedRecipientIds.length || 0} customer(s)`}
          </button>
        </aside>
      </div>
    </section>
  );
}
