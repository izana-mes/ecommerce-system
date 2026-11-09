"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Offer = { supplierProductId: string; productId: string; productName?: string; supplierUserId: string; wholesalePrice?: number; minimumOrderQuantity?: number; stockQuantity?: number; supplierSku?: string };

export default function AdminSupplierProductsPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [mode, setMode] = useState<"SUPPLY_ONLY" | "SUPPLY_AND_SELL">("SUPPLY_ONLY");
  const load = async () => {
    const response = await fetch("/api/v1/admin/supplier-products/pending", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Could not load Supplier product approvals");
    setOffers(Array.isArray(data) ? data : []);
  };
  useEffect(() => { void load().catch(e => toast.error(e instanceof Error ? e.message : "Load failed")); }, []);
  const approve = async (id: string) => {
    setBusy(id);
    try {
      const response = await fetch(`/api/v1/admin/supplier-products/${encodeURIComponent(id)}/approval?approved=true`, { method: "PUT" });
      if (!response.ok) throw new Error("Approval failed");
      toast.success("Supplier product approved for Seller discovery");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Approval failed"); }
    finally { setBusy(null); }
  };
  const updateMode = async () => {
    try {
      const response = await fetch(`/api/v1/admin/resale/suppliers/${encodeURIComponent(supplierId)}/operating-mode`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operatingMode: mode }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "Could not update Supplier mode");
      toast.success("Supplier operating mode updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update mode"); }
  };
  return <main className="mx-auto max-w-6xl space-y-5 p-6"><header><h1 className="text-2xl font-semibold">Supplier Product Approval</h1><p className="text-sm text-slate-600">Review Supplier distribution offers here. Seller Request to Sell approvals remain in Partnerships.</p></header>
    <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"><div className="min-w-64 flex-1"><label className="mb-1 block text-xs font-medium text-slate-600">Supplier account ID</label><input value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" placeholder="UUID" /></div><div><label className="mb-1 block text-xs font-medium text-slate-600">Operating mode</label><select value={mode} onChange={e => setMode(e.target.value as "SUPPLY_ONLY" | "SUPPLY_AND_SELL")} className="rounded border px-3 py-2 text-sm"><option value="SUPPLY_ONLY">Supply only</option><option value="SUPPLY_AND_SELL">Supply and sell</option></select></div><button disabled={!supplierId.trim()} onClick={() => void updateMode()} className="rounded border px-4 py-2 text-sm disabled:opacity-50">Update Supplier mode</button></section>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Product</th><th className="p-3">Supplier</th><th className="p-3">Supplier SKU</th><th className="p-3">Wholesale</th><th className="p-3">Stock / MOQ</th><th className="p-3">Action</th></tr></thead><tbody>{offers.map(offer => <tr key={offer.supplierProductId} className="border-t"><td className="p-3">{offer.productName || offer.productId}<div className="text-xs text-slate-500">{offer.productId}</div></td><td className="p-3">{offer.supplierUserId}</td><td className="p-3">{offer.supplierSku || "—"}</td><td className="p-3">{offer.wholesalePrice ?? "Not set"}</td><td className="p-3">{offer.stockQuantity ?? 0} / {offer.minimumOrderQuantity ?? 1}</td><td className="p-3"><button disabled={busy === offer.supplierProductId || !offer.wholesalePrice} onClick={() => void approve(offer.supplierProductId)} className="rounded bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-50">{busy === offer.supplierProductId ? "Approving…" : "Approve Supplier offer"}</button></td></tr>)}{offers.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No pending Supplier product offers.</td></tr>}</tbody></table></div>
  </main>;
}
