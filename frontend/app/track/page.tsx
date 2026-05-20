"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/components/providers/LocaleProvider";
import { getToken, getUser } from "@/lib/auth";

type TrackingLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type TrackingPayload = {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
  shippingCity?: string | null;
  shippingCountry?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  deliveryLocationLabel?: string | null;
  deliveryLocationAccuracyMeters?: number | null;
  items: TrackingLine[];
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

function stepState(
  orderStatus: string,
  paymentStatus: string,
  step: "placed" | "payment" | "processing" | "shipped" | "complete"
): "done" | "current" | "upcoming" {
  const os = (orderStatus || "").toLowerCase();
  const ps = (paymentStatus || "").toLowerCase();

  const paymentOk = ps === "paid" || ps === "authorized";
  const shipped = os === "shipped" || os === "completed";
  const completed = os === "completed";
  const processing = os === "processing" || os === "paid" || shipped || completed;

  if (step === "placed") return "done";
  if (step === "payment") {
    if (paymentOk) return "done";
    if (ps === "pending" || ps === "failed") return "current";
    return "upcoming";
  }
  if (step === "processing") {
    if (shipped || completed) return "done";
    if (paymentOk && (os === "processing" || os === "pending")) return "current";
    if (paymentOk) return "done";
    return "upcoming";
  }
  if (step === "shipped") {
    if (completed) return "done";
    if (os === "shipped") return "current";
    if (shipped) return "done";
    return "upcoming";
  }
  if (step === "complete") {
    if (completed) return "done";
    if (os === "shipped") return "current";
    return "upcoming";
  }
  return "upcoming";
}

function TrackPageInner() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const token = (searchParams.get("t") || searchParams.get("token") || "").trim();
  const orderHint = (searchParams.get("order") || "").trim();

  const authToken = useMemo(() => getToken(), []);
  const user = useMemo(() => getUser(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrackingPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        if (token) {
          const res = await fetch(`/api/orders/track?token=${encodeURIComponent(token)}`, {
            cache: "no-store"});
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) {
            throw new Error(json?.message || json?.error || "Not found");
          }
          const d = json?.data as TrackingPayload | undefined;
          if (!d?.orderNumber) throw new Error("Not found");
          if (!cancelled) setData(normalizeTracking(d));
          return;
        }

        if (orderHint && (authToken || user)) {
          const res = await fetch(`/api/orders/${encodeURIComponent(orderHint)}/track`, {
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...(authToken ? { } : {})},
            cache: "no-store"});
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) {
            throw new Error(json?.message || json?.error || "Not found");
          }
          const d = json?.data as TrackingPayload | undefined;
          if (!d?.orderNumber) throw new Error("Not found");
          if (!cancelled) setData(normalizeTracking(d));
          return;
        }

        throw new Error("missing");
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error && e.message === "missing" ? t("track_error") : t("track_error"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [token, orderHint, authToken, user, t]);

  const mapSrc =
    data?.deliveryLatitude != null &&
    data?.deliveryLongitude != null &&
    Number.isFinite(data.deliveryLatitude) &&
    Number.isFinite(data.deliveryLongitude)
      ? (() => {
          const lat = Number(data.deliveryLatitude);
          const lon = Number(data.deliveryLongitude);
          const d = 0.02;
          return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d}%2C${lat - d}%2C${lon + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lon}`;
        })()
      : null;

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ marginBottom: 8 }}>{t("track_title")}</h1>
      {token ? (
        <p style={{ color: "#555", fontSize: 14, marginBottom: 20 }}>{t("track_meta_hint")}</p>
      ) : null}

      {loading ? <p>{t("track_loading")}</p> : null}
      {!loading && error ? <p style={{ color: "#b00020" }}>{error}</p> : null}

      {!loading && !error && data ? (
        <>
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              background: "#fff"}}
          >
            <p style={{ margin: "0 0 6px" }}>
              <strong>{t("track_order_number")}:</strong> {data.orderNumber}
            </p>
            <p style={{ margin: "0 0 6px" }}>
              <strong>{t("track_created")}:</strong> {new Date(data.createdAt).toLocaleString()}
            </p>
            <p style={{ margin: "0 0 6px" }}>
              <strong>{t("track_status_order")}:</strong> {data.orderStatus}{" "}
              <strong style={{ marginLeft: 8 }}>{t("track_status_payment")}:</strong> {data.paymentStatus}
            </p>
            {(data.shippingCity || data.shippingCountry) && (
              <p style={{ margin: "8px 0 0" }}>
                <strong>{t("track_shipping_to")}:</strong> {[data.shippingCity, data.shippingCountry]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {data.deliveryLocationLabel ? (
              <p style={{ margin: "6px 0 0", fontSize: 14, color: "#444" }}>
                {t("track_delivery_pin")}: {data.deliveryLocationLabel}
                {data.deliveryLocationAccuracyMeters != null
                  ? ` (±${Math.round(Number(data.deliveryLocationAccuracyMeters))}m)`
                  : ""}
              </p>
            ) : null}
          </div>

          <h2 style={{ fontSize: 18, marginBottom: 10 }}>{t("track_timeline")}</h2>
          <ol style={{ paddingLeft: 18, margin: "0 0 20px", lineHeight: 1.7 }}>
            {(
              [
                ["placed", t("track_step_placed")],
                ["payment", t("track_step_payment")],
                ["processing", t("track_step_processing")],
                ["shipped", t("track_step_shipped")],
                ["complete", t("track_step_complete")],
              ] as const
            ).map(([key, label]) => {
              const st = stepState(data.orderStatus, data.paymentStatus, key);
              const color = st === "done" ? "#188038" : st === "current" ? "#1a73e8" : "#999";
              return (
                <li key={key} style={{ color }}>
                  {label}
                  {st === "current" ? " — …" : ""}
                </li>
              );
            })}
          </ol>

          {mapSrc ? (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>{t("track_map_title")}</h2>
              <iframe title="delivery-map" src={mapSrc} width="100%" height={260} style={{ border: 0, borderRadius: 8 }} loading="lazy" />
            </div>
          ) : null}

          <h2 style={{ fontSize: 18, marginBottom: 8 }}>{t("track_items")}</h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {data.items.map((line) => (
              <li key={`${line.productId}-${line.productName}`}>
                {line.productName} × {line.quantity} — {formatMoney(line.lineTotal, "USD")}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p style={{ marginTop: 24 }}>
        <Link href="/">{t("track_home")}</Link>
        {" · "}
        <Link href="/orders">{t("orders_history")}</Link>
      </p>
    </div>
  );
}

function normalizeTracking(raw: Record<string, unknown>): TrackingPayload {
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const items: TrackingLine[] = itemsRaw.map((row: Record<string, unknown>) => ({
    productId: String(row.productId ?? row.product_id ?? ""),
    productName: String(row.productName ?? row.product_name ?? ""),
    quantity: Number(row.quantity ?? 0) || 0,
    unitPrice: Number(row.unitPrice ?? row.unit_price ?? 0) || 0,
    lineTotal: Number(row.lineTotal ?? row.line_total ?? 0) || 0}));
  const lat = Number(raw.deliveryLatitude ?? raw.delivery_latitude ?? NaN);
  const lon = Number(raw.deliveryLongitude ?? raw.delivery_longitude ?? NaN);
  const acc = Number(raw.deliveryLocationAccuracyMeters ?? raw.delivery_location_accuracy_meters ?? NaN);

  return {
    orderNumber: String(raw.orderNumber ?? raw.order_number ?? ""),
    orderStatus: String(raw.orderStatus ?? raw.order_status ?? ""),
    paymentStatus: String(raw.paymentStatus ?? raw.payment_status ?? ""),
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    shippingCity: (raw.shippingCity ?? raw.shipping_city) as string | null | undefined,
    shippingCountry: (raw.shippingCountry ?? raw.shipping_country) as string | null | undefined,
    deliveryLatitude: Number.isFinite(lat) ? lat : null,
    deliveryLongitude: Number.isFinite(lon) ? lon : null,
    deliveryLocationLabel: (raw.deliveryLocationLabel ?? raw.delivery_location_label) as string | null | undefined,
    deliveryLocationAccuracyMeters: Number.isFinite(acc) ? acc : null,
    items};
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>…</div>}>
      <TrackPageInner />
    </Suspense>
  );
}
