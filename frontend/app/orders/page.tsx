"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { useAppDispatch } from "@/store";
import { addToCart, addToCartAsync, fetchCartAsync } from "@/store/cartSlice";

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
  tracking_secret?: string;
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
      maximumFractionDigits: 2}).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency || "USD"}`;
  }
}
import { useLocale } from "@/components/providers/LocaleProvider";

export default function OrdersPage() {
  const { t } = useLocale();
  const router = useRouter();
  const token = getUser();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const size = 10;
  const user = useMemo(() => getUser(), []);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [reorderingOrderNumber, setReorderingOrderNumber] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!user) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/history?page=${page}&size=${size}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"}});
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

  useEffect(() => {
    void fetchHistory();
  }, [page, user]);

  const handleCancelOrder = async (orderNumber: string) => {
    if (!window.confirm(t("orders_cancel_confirm"))) return;

    setProcessingOrderId(orderNumber);
    try {
      const response = await fetch(`/api/orders/${orderNumber}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"}});

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || "Failed to cancel order");
      }

      void fetchHistory();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleEditClick = (order: Order) => {
    setEditingOrder(order);
    setIsEditModalOpen(true);
  };

  const handleReorder = async (
    orderNumber: string,
    options?: { goToCheckout?: boolean; preferredPayment?: string }
  ) => {
    if (!user) {
      router.push("/login");
      return;
    }
    setReorderingOrderNumber(orderNumber);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/track`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"}});
      const json = (await response.json()) as { success?: boolean; data?: { items?: Record<string, unknown>[] } };
      if (!response.ok || !json?.success || !Array.isArray(json.data?.items)) {
        throw new Error("Could not load order lines for reorder");
      }
      const lines = json.data!.items!;
      const transientAddedItems: Array<{ productID: string; quantity: number }> = [];
      for (const line of lines) {
        const productID = String(line.productId ?? line.product_id ?? "");
        const productName = String(line.productName ?? line.product_name ?? "");
        const productPrice = Number(line.unitPrice ?? line.unit_price ?? 0) || 0;
        const quantity = Math.min(20, Math.max(1, Number(line.quantity ?? 1) || 1));
        if (!productID) continue;
        transientAddedItems.push({ productID, quantity });
        const payload = {
          productID,
          productName,
          productPrice,
          productReviews: "0"};
        for (let i = 0; i < quantity; i += 1) {
          if (user) {
            await dispatch(addToCartAsync(payload)).unwrap();
          } else {
            dispatch(addToCart(payload));
          }
        }
      }
      if (options?.goToCheckout && typeof window !== "undefined" && transientAddedItems.length > 0) {
        sessionStorage.setItem(
          "checkoutTransientReorder",
          JSON.stringify({
            source: "order-payment",
            orderNumber,
            items: transientAddedItems,
            createdAt: Date.now(),
          })
        );
      }
      await dispatch(fetchCartAsync()).unwrap().catch(() => null);
      const payment = String(options?.preferredPayment || "").trim().toLowerCase();
      const checkoutUrl = payment === "paypal"
        ? "/cart?step=checkout&payment=paypal"
        : "/cart?step=checkout";
      router.push(options?.goToCheckout ? checkoutUrl : "/cart");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reorder failed");
    } finally {
      setReorderingOrderNumber(null);
    }
  };

  const handlePayNow = (order: Order) => {
    if (typeof window === "undefined") {
      return;
    }
    sessionStorage.setItem(
      "checkoutPayNowOrder",
      JSON.stringify({
        id: order.id,
        orderNumber: order.order_number,
        paymentMethod: order.payment_method,
        currency: order.currency,
        subtotal: Number(order.subtotal || 0),
        shippingFee: Number(order.shipping_fee || 0),
        vat: Number(order.vat || 0),
        totalAmount: Number(order.total_amount || 0),
        items: (order.items || []).map((item) => ({
          productID: item.product_id,
          productName: item.product_name,
          productPrice: Number(item.unit_price || 0),
          quantity: Number(item.quantity || 1),
        })),
      })
    );

    const method = String(order.payment_method || "").toLowerCase();
    let paymentParam = "";
    if (method === "paypal") paymentParam = "paypal";
    else if (method === "vnpay" || method === "vnpayqr") paymentParam = "vnpay";
    else if (method === "card" || method === "credit_card" || method === "stripe") paymentParam = "card";

    const payQuery = `payOrder=${encodeURIComponent(order.order_number)}`;
    const paymentQuery = paymentParam ? `&payment=${paymentParam}` : "";
    router.push(`/cart?step=checkout${paymentQuery}&${payQuery}`);
  };

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
                background: "#fff"}}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{order.order_number}</strong>
                <span>{new Date(order.created_at).toLocaleString()}</span>
              </div>
              <p style={{ margin: "8px 0 6px" }}>
                {t("orders_status")}{order.order_status}{t("orders_payment")}{order.payment_status} ({order.payment_method})
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "10px 0", alignItems: "center" }}>
                {order.tracking_secret ? (
                  <Link
                    href={`/track?t=${encodeURIComponent(order.tracking_secret)}`}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#0f766e",
                      color: "white",
                      borderRadius: 4,
                      textDecoration: "none",
                      fontSize: 14}}
                  >
                    {t("orders_track")}
                  </Link>
                ) : (
                  <Link
                    href={`/track?order=${encodeURIComponent(order.order_number)}`}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#0f766e",
                      color: "white",
                      borderRadius: 4,
                      textDecoration: "none",
                      fontSize: 14}}
                  >
                    {t("orders_track_auth")}
                  </Link>
                )}
                <Link
                  href={`/contact?order=${encodeURIComponent(order.order_number)}`}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    textDecoration: "none",
                    color: "#111",
                    fontSize: 14}}
                >
                  {t("orders_support")}
                </Link>
                <button
                  type="button"
                  onClick={() => void handleReorder(order.order_number)}
                  disabled={reorderingOrderNumber === order.order_number}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#7c3aed",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 14}}
                >
                  {reorderingOrderNumber === order.order_number ? t("orders_reorder_loading") : t("orders_reorder")}
                </button>
                {(order.order_status === "pending" || ["pending", "unpaid"].includes(String(order.payment_status).toLowerCase())) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePayNow(order)}
                      style={{
                        padding: "6px 14px",
                        backgroundColor: "#f59e0b",
                        color: "#1c1c1c",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 14}}
                    >
                      💳 Pay Now
                    </button>
                    <button
                      onClick={() => handleCancelOrder(order.order_number)}
                      disabled={processingOrderId === order.order_number}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#ff4d4f",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer"}}>
                      {processingOrderId === order.order_number ? t("orders_cancelling") : t("orders_cancel")}
                    </button>
                    <button
                      onClick={() => handleEditClick(order)}
                      disabled={processingOrderId === order.order_number}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#1890ff",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer"}}>
                      {t("orders_edit")}
                    </button>
                  </>
                ) : null}
              </div>
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

      {isEditModalOpen && editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false);
            void fetchHistory();
          }}
          t={t}
        />
      )}
    </div>
  );
}

function EditOrderModal({
  order,
  onClose,
  onSuccess,
  t}: {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: any) => string;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    shippingAddressLine1: "",
    shippingAddressLine2: "",
    shippingCity: "",
    shippingCountry: "",
    shippingPostalCode: "",
    customerPhone: "",
    notes: ""});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${order.order_number}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify(formData)});

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || "Failed to update order");
      }

      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000}}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: 24,
          borderRadius: 8,
          width: "100%",
          maxWidth: 500,
          maxHeight: "90vh",
          overflowY: "auto"}}
      >
        <h2 style={{ marginBottom: 20 }}>{t("orders_edit")}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Address Line 1</label>
            <input
              type="text"
              required
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              value={formData.shippingAddressLine1}
              onChange={(e) => setFormData({ ...formData, shippingAddressLine1: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Address Line 2 (Optional)</label>
            <input
              type="text"
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              value={formData.shippingAddressLine2}
              onChange={(e) => setFormData({ ...formData, shippingAddressLine2: e.target.value })}
            />
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: 4 }}>City</label>
              <input
                type="text"
                required
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
                value={formData.shippingCity}
                onChange={(e) => setFormData({ ...formData, shippingCity: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: 4 }}>Postal Code</label>
              <input
                type="text"
                required
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
                value={formData.shippingPostalCode}
                onChange={(e) => setFormData({ ...formData, shippingPostalCode: e.target.value })}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Phone</label>
            <input
              type="text"
              required
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Notes (Optional)</label>
            <textarea
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc", minHeight: 80 }}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 4, border: "1px solid #ccc", cursor: "pointer" }}
            >
              {t("shop_cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 16px",
                borderRadius: 4,
                border: "none",
                backgroundColor: "#1890ff",
                color: "white",
                cursor: "pointer"}}
            >
              {loading ? t("orders_updating") : t("shop_save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
