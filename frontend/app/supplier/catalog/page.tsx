"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";

type Row = {
  productID?: string;
  productName?: string;
  category?: string;
  stockQuantity?: number;
  active?: boolean;
};

export default function SupplierCatalogPage() {
  const router = useRouter();
  const token = getToken();
  const [allowed, setAllowed] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getUser();
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json"},
          cache: "no-store"});
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        const profile = data?.data;
        const ok =
          String(profile?.role || "").toLowerCase() === "supplier" ||
          (Array.isArray(profile?.roles) && profile.roles.includes("ROLE_SUPPLIER"));
        setAllowed(ok && response.ok);
      } catch {
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setLoadingAccess(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  const load = useCallback(async () => {
    if (!allowed || !token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/products/supplier/mine", {
        headers: {        },
        cache: "no-store"});
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to load catalog");
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, token]);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  if (!token) return null;
  if (loadingAccess) return <main style={{ padding: "2rem" }}>Loading…</main>;
  if (!allowed)
    return <main style={{ padding: "2rem" }}>Supplier role required.</main>;

  return (
    <main style={{ padding: "2rem", maxWidth: 720 }}>
      <h1 style={{ fontSize: "1.35rem", marginBottom: "0.5rem" }}>Your supplier SKUs</h1>
      <p style={{ color: "#555", marginBottom: "1rem" }}>
        Products linked to your account after an approved supplier create-request.
      </p>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p>Loading catalog…</p> : null}
      {!loading && rows.length === 0 ? (
        <p style={{ color: "#666" }}>No linked products yet. Submit a catalog change via the catalog API flow.</p>
      ) : null}
      <ul style={{ paddingLeft: "1.1rem" }}>
        {rows.map((r, idx) => (
          <li key={r.productID || `sku-${idx}`} style={{ marginBottom: "0.35rem" }}>
            <strong>{r.productID}</strong> — {r.productName}{" "}
            <span style={{ color: "#666" }}>
              ({r.category || "Uncategorized"}, stock {r.stockQuantity ?? 0}, {r.active ? "active" : "inactive"})
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
