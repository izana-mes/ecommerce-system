"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Offer = {
  supplierProductId: string;
  productId: string;
  productName: string;
  sku?: string;
  wholesalePrice: number;
  stockQuantity: number;
  reservedQuantity: number;
  minimumOrderQuantity: number;
  approved: boolean;
  available: boolean;
  allowResale?: boolean;
  directRetailEnabled: boolean;
  directRetailPrice?: number;
  supplyTerms?: string;
};

const blank = {
  productId: "",
  sku: "",
  wholesalePrice: "",
  stockQuantity: "0",
  minimumOrderQuantity: "1",
  available: true,
  supplyTerms: ""
};

export default function SupplierSupplyProductsPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [operatingMode, setOperatingMode] = useState<"SUPPLY_ONLY" | "SUPPLY_AND_SELL">("SUPPLY_ONLY");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/supplier/products/mine", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Could not load Supplier products");
      setOffers(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetch("/api/v1/supplier/resale/operating-mode", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setOperatingMode(d.operatingMode || "SUPPLY_ONLY"))
      .catch(() => setOperatingMode("SUPPLY_ONLY"));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch(editingOfferId ? `/api/v1/supplier/products/${editingOfferId}` : "/api/v1/supplier/products", {
        method: editingOfferId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          allowResale: form.available,
          wholesalePrice: Number(form.wholesalePrice),
          stockQuantity: Number(form.stockQuantity),
          minimumOrderQuantity: Number(form.minimumOrderQuantity)
        })
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data?.message || "Offer could not be saved");
        return;
      }
      toast.success(editingOfferId ? "Supplier offer updated" : "Supplier offer submitted for Admin approval");
      setForm(blank);
      setEditingOfferId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const toggleResale = async (offer: Offer) => {
    const nextState = !offer.available;
    setBusy(offer.supplierProductId);
    try {
      const res = await fetch(`/api/v1/supplier/products/${offer.supplierProductId}/allow-resale`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowResale: nextState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Could not toggle resale availability");
      toast.success(nextState ? "Resale enabled for Sellers" : "Resale disabled (existing approvals preserved)");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setBusy(null);
    }
  };

  const directRetail = async (offer: Offer, enabled: boolean) => {
    setBusy(offer.supplierProductId);
    try {
      const retailPrice = enabled ? Number(window.prompt("Customer retail price", String(offer.directRetailPrice || "")) || 0) : null;
      if (enabled && (!retailPrice || retailPrice <= 0)) return;
      const response = await fetch(`/api/v1/supplier/products/${offer.supplierProductId}/direct-retail`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, retailPrice })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Could not update direct retail");
      toast.success(enabled ? "Direct retail enabled" : "Direct retail disabled");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Supplier Product Management</h1>
        </div>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-base font-semibold text-slate-800 mb-3">{editingOfferId ? "Edit Supplier Product Offer" : "Add Supplier Product Offer"}</h2>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          <input
            required
            value={form.productId}
            onChange={e => setForm({ ...form, productId: e.target.value })}
            placeholder="Global Product ID (e.g. PROD-101)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={form.sku}
            onChange={e => setForm({ ...form, sku: e.target.value })}
            placeholder="Supplier SKU"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.wholesalePrice}
            onChange={e => setForm({ ...form, wholesalePrice: e.target.value })}
            placeholder="Wholesale price ($)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            min="0"
            value={form.stockQuantity}
            onChange={e => setForm({ ...form, stockQuantity: e.target.value })}
            placeholder="Available Inventory"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            min="1"
            value={form.minimumOrderQuantity}
            onChange={e => setForm({ ...form, minimumOrderQuantity: e.target.value })}
            placeholder="Minimum Order Quantity (MOQ)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={form.supplyTerms}
            onChange={e => setForm({ ...form, supplyTerms: e.target.value })}
            placeholder="Supply terms / commercial note"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2 text-sm md:col-span-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={form.available}
                onChange={e => setForm({ ...form, available: e.target.checked })}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Allow Resale (Discoverable by Sellers)
            </label>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 md:col-span-2"
          >
            {editingOfferId ? "Save Supplier Offer" : "Create Supplier Offer"}
          </button>
          {editingOfferId ? <button type="button" onClick={() => { setEditingOfferId(null); setForm(blank); }} className="rounded-lg border px-4 py-2 text-sm">Cancel edit</button> : null}
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Your Owned Supplier Products</h2>
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Loading products...
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Global Product</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Wholesale Price</th>
                  <th className="p-3">Inventory (Avail / Rsvd)</th>
                  <th className="p-3">MOQ</th>
                  <th className="p-3">Admin Approval</th>
                  <th className="p-3">Resale Availability</th>
                  {operatingMode === "SUPPLY_AND_SELL" && <th className="p-3">Direct Retail</th>}
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map(offer => (
                  <tr key={offer.supplierProductId} className="hover:bg-slate-50/60">
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{offer.productName}</div>
                      <div className="text-xs text-slate-400 font-mono">{offer.productId}</div>
                    </td>
                    <td className="p-3 text-slate-600">{offer.sku || "—"}</td>
                    <td className="p-3 font-medium text-slate-900">${offer.wholesalePrice}</td>
                    <td className="p-3 text-slate-700">
                      <span className="font-semibold text-emerald-700">{offer.stockQuantity}</span>
                      <span className="text-xs text-slate-400"> / {offer.reservedQuantity} reserved</span>
                    </td>
                    <td className="p-3 text-slate-600">{offer.minimumOrderQuantity}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          offer.approved
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {offer.approved ? "Approved" : "Pending Approval"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            offer.available
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {offer.available ? "Resale Enabled" : "Resale Disabled"}
                        </span>
                        <button
                          disabled={busy === offer.supplierProductId}
                          onClick={() => void toggleResale(offer)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
                        >
                          {offer.available ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                    {operatingMode === "SUPPLY_AND_SELL" && (
                      <td className="p-3">
                        <div className="text-xs font-medium">
                          {offer.directRetailEnabled ? `$${offer.directRetailPrice}` : "Disabled"}
                        </div>
                        <button
                          disabled={busy === offer.supplierProductId || !offer.approved}
                          onClick={() => void directRetail(offer, !offer.directRetailEnabled)}
                          className="mt-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
                        >
                          {offer.directRetailEnabled ? "Disable Retail" : "Set Retail Price"}
                        </button>
                      </td>
                    )}
                    <td className="p-3"><button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100" onClick={() => { setEditingOfferId(offer.supplierProductId); setForm({ productId: offer.productId, sku: offer.sku || "", wholesalePrice: String(offer.wholesalePrice), stockQuantity: String(offer.stockQuantity), minimumOrderQuantity: String(offer.minimumOrderQuantity), available: Boolean(offer.available), supplyTerms: offer.supplyTerms || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit offer</button></td>
                  </tr>
                ))}
                {offers.length === 0 && (
                  <tr>
                    <td
                      colSpan={operatingMode === "SUPPLY_AND_SELL" ? 9 : 8}
                      className="p-8 text-center text-slate-500"
                    >
                      No Supplier products configured yet. Use the form above to add your first offer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
