"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  Layers,
  Search,
  RotateCw,
  History,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  X,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

type Allocation = {
  id: string;
  listingId: string;
  productId: string;
  productName: string;
  sellerId: string;
  sellerName: string;
  allocated: number;
  sold: number;
  reserved: number;
  remaining: number;
  status: string;
};

type Audit = {
  previousQuantity: number;
  newQuantity: number;
  supplierUserId: string;
  supplierName: string;
  reason?: string;
  changedAt: string;
};

export default function SupplierAllocationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "low" | "exhausted">("all");

  // Edit Allocation Modal State
  const [editingItem, setEditingItem] = useState<Allocation | null>(null);
  const [newAllocationQty, setNewAllocationQty] = useState<string>("");
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");
  const [savingAllocation, setSavingAllocation] = useState(false);

  // History Modal State
  const [historyItem, setHistoryItem] = useState<Allocation | null>(null);
  const [historyRecords, setHistoryRecords] = useState<Audit[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const syncUser = useCallback(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login?returnTo=/supplier/allocations");
      return;
    }
    if (user.role !== "supplier" && user.role !== "admin") {
      router.replace("/profile");
    }
  }, [router]);

  useEffect(() => {
    syncUser();
    return subscribeToAuthChanges(syncUser);
  }, [syncUser]);

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/supplier/resale/allocations", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load allocations");
      const list: Allocation[] = Array.isArray(data) ? data : data?.data || [];
      setRows(list);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllocations();
  }, [loadAllocations]);

  const openEditModal = (item: Allocation) => {
    setEditingItem(item);
    setNewAllocationQty(String(item.allocated));
    setAdjustmentReason("");
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setNewAllocationQty("");
    setAdjustmentReason("");
  };

  const handleSaveAllocation = async () => {
    if (!editingItem) return;
    const qty = parseInt(newAllocationQty.trim(), 10);
    const minRequired = editingItem.sold + editingItem.reserved;

    if (!Number.isInteger(qty) || qty < 0) {
      toast.error("Allocation must be a non-negative whole number");
      return;
    }
    if (qty < minRequired) {
      toast.error(`Allocation must be at least ${minRequired} to cover ${editingItem.sold} sold + ${editingItem.reserved} reserved units.`);
      return;
    }

    setSavingAllocation(true);
    try {
      const res = await fetch(`/api/v1/supplier/resale/allocations/${editingItem.listingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocatedQuantity: qty,
          reason: adjustmentReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to update allocation");
      }
      toast.success("Inventory allocation updated successfully!");
      closeEditModal();
      await loadAllocations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingAllocation(false);
    }
  };

  const openHistoryModal = async (item: Allocation) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/v1/supplier/resale/allocations/${item.listingId}/history`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load audit history");
      setHistoryRecords(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "History unavailable");
      setHistoryRecords([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeHistoryModal = () => {
    setHistoryItem(null);
    setHistoryRecords([]);
  };

  // Filtered rows
  const filtered = useMemo(() => {
    let result = rows;
    if (filterMode === "low") {
      result = result.filter((r) => r.remaining > 0 && r.remaining <= 5);
    } else if (filterMode === "exhausted") {
      result = result.filter((r) => r.remaining <= 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.productId.toLowerCase().includes(q) ||
          r.sellerName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, filterMode, search]);

  // Overall KPIs
  const totalAllocated = useMemo(() => rows.reduce((acc, r) => acc + r.allocated, 0), [rows]);
  const totalSold = useMemo(() => rows.reduce((acc, r) => acc + r.sold, 0), [rows]);
  const totalReserved = useMemo(() => rows.reduce((acc, r) => acc + r.reserved, 0), [rows]);
  const totalRemaining = useMemo(() => rows.reduce((acc, r) => acc + r.remaining, 0), [rows]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Seller Inventory Allocations</h1>
          <p className="mt-1 text-sm text-slate-600">Sold and reserved units cannot be reduced.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadAllocations()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition"
          >
            <RotateCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <Link
            href="/supplier/resale-requests"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 transition"
          >
            Review Requests
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Allocated</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{totalAllocated.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span></div>
          <div className="mt-1 text-xs text-slate-500">{rows.length} active Seller listings</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total Sold</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{totalSold.toLocaleString()} <span className="text-xs font-normal text-emerald-500">units</span></div>
          <div className="mt-1 text-xs text-slate-500">Fulfilled customer orders</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">In Cart / Reserved</div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{totalReserved.toLocaleString()} <span className="text-xs font-normal text-amber-500">units</span></div>
          <div className="mt-1 text-xs text-slate-500">Held during checkout</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Available to Sell</div>
          <div className="mt-2 text-2xl font-bold text-indigo-700">{totalRemaining.toLocaleString()} <span className="text-xs font-normal text-indigo-500">units</span></div>
          <div className="mt-1 text-xs text-slate-500">Remaining Seller sellable stock</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, SKU, or Seller..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Filter Stock:</span>
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterMode === "all" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("low")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterMode === "low" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Low Stock (&le;5)
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("exhausted")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterMode === "exhausted" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Exhausted (0)
          </button>
        </div>
      </div>

      {/* Allocations Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading allocations...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-2 text-sm font-semibold text-slate-700">No allocations match</h3>
            <p className="mt-1 text-xs text-slate-500">
              {rows.length === 0
                ? "Approve Seller resale requests to establish inventory allocations."
                : "No allocations match your search or filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Seller Partner</th>
                  <th className="py-3 px-4 text-center">Total Allocated</th>
                  <th className="py-3 px-4 text-center">Sold</th>
                  <th className="py-3 px-4 text-center">Reserved</th>
                  <th className="py-3 px-4 text-center">Remaining</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((item) => {
                  const isOut = item.remaining <= 0;
                  const isLow = !isOut && item.remaining <= 5;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{item.productName}</div>
                        <div className="font-mono text-[11px] text-slate-400">{item.productId}</div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{item.sellerName || "Seller Partner"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900 text-sm">
                        {item.allocated.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-emerald-600">
                        {item.sold.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-amber-600">
                        {item.reserved.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                            isOut
                              ? "bg-rose-100 text-rose-800"
                              : isLow
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {item.remaining.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                            isOut
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : isLow
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          {isOut ? "Exhausted" : isLow ? "Low Stock" : "Active"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition"
                          >
                            <Edit3 className="w-3 h-3" /> Adjust
                          </button>
                          <button
                            type="button"
                            onClick={() => void openHistoryModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition"
                          >
                            <History className="w-3 h-3" /> History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Allocation Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Adjust Inventory Allocation</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingItem.productName} · {editingItem.sellerName}</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Metrics */}
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center border border-slate-200/60">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400">Sold</div>
                <div className="text-sm font-bold text-emerald-600">{editingItem.sold}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400">Reserved</div>
                <div className="text-sm font-bold text-amber-600">{editingItem.reserved}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400">Current Total</div>
                <div className="text-sm font-bold text-slate-800">{editingItem.allocated}</div>
              </div>
            </div>

            {/* New Allocation Input */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  New Total Allocation Quantity (Units)
                </label>
                <input
                  type="number"
                  min={editingItem.sold + editingItem.reserved}
                  value={newAllocationQty}
                  onChange={(e) => setNewAllocationQty(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Minimum allowed is <span className="font-semibold text-slate-700">{editingItem.sold + editingItem.reserved}</span> units to cover already sold and reserved inventory.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Reason for Adjustment <span className="text-slate-400 font-normal">(optional audit note)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Replenishment, Seasonal boost, Seller request"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Calculated Delta */}
              {Number.isInteger(parseInt(newAllocationQty, 10)) && (
                <div className="rounded-lg bg-indigo-50/70 p-3 text-xs border border-indigo-100 flex items-center justify-between">
                  <span className="text-indigo-900 font-medium">New Sellable Balance:</span>
                  <span className="font-bold text-indigo-700">
                    {Math.max(0, parseInt(newAllocationQty, 10) - editingItem.sold - editingItem.reserved)} units
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={savingAllocation}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAllocation}
                disabled={savingAllocation}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {savingAllocation ? "Saving..." : "Save Allocation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Allocation Audit History</h3>
                <p className="text-xs text-slate-500 mt-0.5">{historyItem.productName} · {historyItem.sellerName}</p>
              </div>
              <button
                type="button"
                onClick={closeHistoryModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-10 text-center text-xs text-slate-400">Loading audit history...</div>
            ) : historyRecords.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No adjustments recorded yet. Current allocation remains at initial level.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {historyRecords.map((audit, idx) => {
                  const delta = audit.newQuantity - audit.previousQuantity;
                  return (
                    <div key={idx} className="py-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">
                          {audit.previousQuantity} <ArrowRight className="inline w-3 h-3 text-slate-400" /> {audit.newQuantity} units
                        </span>
                        <span className={`font-bold ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {delta >= 0 ? `+${delta}` : delta}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Updated by {audit.supplierName || "Supplier"}</span>
                        <span>{new Date(audit.changedAt).toLocaleString()}</span>
                      </div>
                      {audit.reason && (
                        <div className="text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded">
                          &ldquo;{audit.reason}&rdquo;
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={closeHistoryModal}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
