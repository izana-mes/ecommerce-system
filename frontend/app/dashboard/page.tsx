"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {getUser, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";

type OrderItem = {
  product_name: string;
};

type Order = {
  id: number;
  order_number: string;
  total_amount: number;
  currency: string;
  order_status: string;
  created_at: string;
  items: OrderItem[];
};

type HistoryResponse = {
  content: Order[];
};

type CouponItem = {
  id: number;
  status: "pending" | "ready" | "used" | "expired";
  coupon: {
    code: string;
    title: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
  };
};

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

export default function UserDashboardPage() {
  const router = useRouter();
  const token = getUser();
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [firstName, setFirstName] = useState("User");

  const syncUser = useCallback(async () => {
    const currentUser = getUser();
    if (!currentUser) {
      router.replace("/login?returnTo=/dashboard");
      return false;
    }

    const refreshed = await refreshCurrentUserFromServer();
    const nextUser = refreshed || currentUser;

    if (nextUser.role === "admin") {
      router.replace("/admin");
      return false;
    }
    if (nextUser.role === "supplier") {
      router.replace("/supplier");
      return false;
    }
    if (nextUser.role === "shipper") {
      router.replace("/shipper/dashboard");
      return false;
    }
    if (nextUser.role === "employee") {
      router.replace("/staff");
      return false;
    }

    setFirstName(nextUser.firstName || "User");
    return true;
  }, [router]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const response = await fetch("/api/orders/history?page=0&size=5", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"}});
      const data = (await response.json()) as Partial<HistoryResponse> & { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load order history");
      }
      setOrders(Array.isArray(data.content) ? data.content : []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load order history");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchCoupons = useCallback(async () => {
    setCouponsLoading(true);
    try {
      const response = await fetch("/api/coupons/notifications", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: token ? { } : undefined});
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load coupons");
      }
      setCoupons(Array.isArray(data?.content) ? data.content : []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load coupons");
      setCoupons([]);
    } finally {
      setCouponsLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const allowed = await syncUser();
      if (allowed) {
        await Promise.all([fetchOrders(), fetchCoupons()]);
      }
      setLoading(false);
    };

    void run();
    return subscribeToAuthChanges(() => {
      void run();
    });
  }, [fetchCoupons, fetchOrders, syncUser]);

  const readyCoupons = useMemo(() => coupons.filter((item) => item.status === "ready").length, [coupons]);
  const pendingCoupons = useMemo(() => coupons.filter((item) => item.status === "pending").length, [coupons]);
  const totalSpent = useMemo(() => orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0), [orders]);

  if (loading) {
    return <main style={{ maxWidth: 1140, margin: "0 auto", padding: "42px 16px" }}>Loading your dashboard...</main>;
  }

  return (
    <main style={{ background: "#f8fafc", minHeight: "70vh", padding: "36px 16px" }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={cardStyle}>
          <h1 style={{ margin: 0, fontSize: 32 }}>Welcome back, {firstName}!</h1>
          <p style={{ margin: "10px 0 0", color: "#475467" }}>
            Your account overview with orders, coupons, and quick shopping actions.
          </p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <article style={metricCardStyle}>
            <strong style={metricValueStyle}>{orders.length}</strong>
            <span style={metricLabelStyle}>Recent orders</span>
          </article>
          <article style={metricCardStyle}>
            <strong style={metricValueStyle}>{formatMoney(totalSpent, "USD")}</strong>
            <span style={metricLabelStyle}>Spent (latest 5 orders)</span>
          </article>
          <article style={metricCardStyle}>
            <strong style={metricValueStyle}>{readyCoupons}</strong>
            <span style={metricLabelStyle}>Ready coupons</span>
          </article>
          <article style={metricCardStyle}>
            <strong style={metricValueStyle}>{pendingCoupons}</strong>
            <span style={metricLabelStyle}>Pending coupons</span>
          </article>
        </section>

        <section style={cardStyle}>
          <div style={headerRowStyle}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Quick actions</h2>
              <p style={subtleTextStyle}>Move faster between your most-used pages.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/shop" style={primaryLinkStyle}>Shop now</Link>
            <Link href="/orders" style={secondaryLinkStyle}>Order history</Link>
            <Link href="/expenses" style={secondaryLinkStyle}>Expense management</Link>
            <Link href="/wishlist" style={secondaryLinkStyle}>Wishlist</Link>
            <Link href="/profile" style={secondaryLinkStyle}>Account settings</Link>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={headerRowStyle}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Recent orders</h2>
              <p style={subtleTextStyle}>Last 5 orders from your account.</p>
            </div>
            <button type="button" onClick={() => void fetchOrders()} style={secondaryButtonStyle} disabled={ordersLoading}>
              {ordersLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {orders.length === 0 ? (
            <p style={emptyStyle}>{ordersLoading ? "Loading orders..." : "No orders found yet."}</p>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {orders.map((order) => (
                <article key={order.id} style={itemCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong>{order.order_number}</strong>
                    <span style={mutedTextStyle}>{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    <span style={mutedTextStyle}>{order.order_status}</span>
                    <strong>{formatMoney(order.total_amount, order.currency || "USD")}</strong>
                  </div>
                  <p style={{ margin: "8px 0 0", color: "#667085" }}>
                    {order.items.slice(0, 2).map((item) => item.product_name).join(", ")}
                    {order.items.length > 2 ? ` +${order.items.length - 2} more` : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <div style={headerRowStyle}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Coupon highlights</h2>
              <p style={subtleTextStyle}>Your latest coupon notifications.</p>
            </div>
            <button type="button" onClick={() => void fetchCoupons()} style={secondaryButtonStyle} disabled={couponsLoading}>
              {couponsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {coupons.length === 0 ? (
            <p style={emptyStyle}>{couponsLoading ? "Loading coupons..." : "No coupon notifications yet."}</p>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {coupons.slice(0, 4).map((item) => (
                <article key={item.id} style={itemCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong>{item.coupon.title || item.coupon.code}</strong>
                    <span style={statusPillStyle(item.status)}>{item.status}</span>
                  </div>
                  <p style={{ margin: "6px 0 0", color: "#475467" }}>
                    {item.coupon.discountType === "percentage"
                      ? `${item.coupon.discountValue}% off`
                      : `${formatMoney(item.coupon.discountValue, "USD")} off`}
                    {" · "}
                    Code: {item.coupon.code}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  padding: 24,
  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)"};

const metricCardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 18,
  border: "1px solid rgba(16, 24, 40, 0.08)",
  display: "grid",
  gap: 6};

const metricValueStyle: React.CSSProperties = {
  fontSize: 26,
  color: "#111827"};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#667085"};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
  gap: 10};

const subtleTextStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#667085"};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(16, 24, 40, 0.12)",
  borderRadius: 999,
  padding: "10px 14px",
  background: "#fff",
  cursor: "pointer"};

const primaryLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  borderRadius: 999,
  padding: "10px 16px",
  background: "#111827",
  color: "#fff",
  fontWeight: 600};

const secondaryLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  borderRadius: 999,
  padding: "10px 16px",
  border: "1px solid rgba(16, 24, 40, 0.12)",
  color: "#111827",
  fontWeight: 600};

const itemCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(16, 24, 40, 0.08)",
  background: "#fcfcfd"};

const mutedTextStyle: React.CSSProperties = {
  color: "#667085"};

const emptyStyle: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#667085"};

function statusPillStyle(status: CouponItem["status"]): React.CSSProperties {
  if (status === "ready") {
    return {
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      textTransform: "capitalize",
      color: "#027a48",
      background: "#ecfdf3"};
  }
  if (status === "pending") {
    return {
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      textTransform: "capitalize",
      color: "#b54708",
      background: "#fffaeb"};
  }
  if (status === "used") {
    return {
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      textTransform: "capitalize",
      color: "#344054",
      background: "#f2f4f7"};
  }
  return {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    textTransform: "capitalize",
    color: "#b42318",
    background: "#fef3f2"};
}
