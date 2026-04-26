"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, getUser } from "@/lib/auth";

type OrderItem = {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

type Order = {
  id: number;
  order_number: string;
  subtotal: number;
  shipping_fee: number;
  vat: number;
  total_amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  created_at: string;
  items: OrderItem[];
};

type HistoryResponse = {
  content: Order[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency || "USD"}`;
  }
}
import { useLocale } from "@/components/providers/LocaleProvider";

export default function OrdersPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const size = 10;

  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUser(), []);

  useEffect(() => {
    if (!token && !user) {
      router.replace("/login");
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/orders/history?page=${page}&size=${size}`, {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = (await response.json()) as Partial<HistoryResponse> & {
          message?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data?.message || data?.error || "Failed to fetch order history");
        }

        setOrders(Array.isArray(data.content) ? data.content : []);
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch order history");
      } finally {
        setLoading(false);
      }
    };

    void fetchHistory();
  }, [page, router, token, user]);

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ marginBottom: 16 }}>{t("orders_history")}</h1>
      <p style={{ marginBottom: 20 }}>
        <Link href="/profile">{t("orders_back_profile")}</Link>
      </p>

      {loading ? <p>{t("orders_loading")}</p> : null}
      {error ? <p style={{ color: "#c00" }}>{error}</p> : null}

      {!loading && !error && orders.length === 0 ? <p>{t("orders_none")}</p> : null}

      {!loading && !error && orders.length > 0
        ? orders.map((order) => (
            <div
              key={order.id}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                padding: 16,
                marginBottom: 14,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{order.order_number}</strong>
                <span>{new Date(order.created_at).toLocaleString()}</span>
              </div>
              <p style={{ margin: "8px 0 6px" }}>
                {t("orders_status")}{order.order_status}{t("orders_payment")}{order.payment_status} ({order.payment_method})
              </p>
              <p style={{ margin: "0 0 10px" }}>
                {t("orders_subtotal")}{formatMoney(order.subtotal, order.currency)}{t("orders_shipping")}
                {formatMoney(order.shipping_fee, order.currency)}{t("orders_vat")}
                {formatMoney(order.vat, order.currency)}
              </p>
              <p style={{ margin: "0 0 10px" }}>
                {t("orders_total")}<strong>{formatMoney(order.total_amount, order.currency)}</strong>
              </p>
              <div>
                {order.items.map((item) => (
                  <p key={`${order.id}-${item.product_id}`} style={{ margin: "4px 0" }}>
                    {item.product_name} x{item.quantity} ({formatMoney(item.unit_price, order.currency)}{t("orders_each")}) -{" "}
                    {formatMoney(item.line_total, order.currency)}
                  </p>
                ))}
              </div>
            </div>
          ))
        : null}

      {!loading && !error && totalPages > 1 ? (
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0}>
            {t("orders_prev")}
          </button>
          <span>
            {t("orders_page")}{page + 1}{t("orders_page_of")}{totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            {t("orders_next")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
