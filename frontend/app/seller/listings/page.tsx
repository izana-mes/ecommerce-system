"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  Store,
  Search,
  Plus,
  RotateCw,
  Edit3,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  X,
  ShieldAlert,
  Layers,
  Tag,
  ExternalLink,
} from "lucide-react";

type Listing = {
  id: string;
  authorizationId?: string;
  supplierProductId: string;
  supplierProductName?: string;
  supplierProductImage?: string;
  supplierDisplayName?: string;
  supplierWholesalePrice?: number;
  supplierSku?: string;
  customTitle?: string;
  retailPrice: number;
  active?: boolean;
  allocatedQuantity?: number;
  soldQuantity?: number;
  reservedQuantity?: number;
  remainingQuantity?: number;
  createdAt?: string;
};

type ActiveAuthorization = {
  id: string;
  supplierProductId: string;
  supplierProductName?: string;
  supplierProductImage?: string;
  supplierProductPrice?: number;
  supplierUserId: string;
  initialAllocationQuantity?: number;
  active: boolean;
};

const FALLBACK_IMAGE = "/Products/product_1.jpg";

function resolveImage(src?: string | null): string {
  const val = String(src ?? "").trim();
  if (!val) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(val) || val.startsWith("/") || val.startsWith("/Products/")) {
    return val;
  }
  return FALLBACK_IMAGE;
}

export default function SellerListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "out">("all");

  // Edit Listing Modal State
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // View Details Modal State
  const [detailsListing, setDetailsListing] = useState<Listing | null>(null);

  // Create Listing Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [authorizations, setAuthorizations] = useState<ActiveAuthorization[]>([]);
  const [loadingAuths, setLoadingAuths] = useState(false);
  const [selectedAuthId, setSelectedAuthId] = useState("");
  const [createCustomTitle, setCreateCustomTitle] = useState("");
  const [createRetailPrice, setCreateRetailPrice] = useState("");
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const syncUser = useCallback(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login?returnTo=/seller/listings");
      return;
    }
    if (user.role !== "seller" && user.role !== "admin") {
      router.replace("/profile");
    }
  }, [router]);

  useEffect(() => {
    syncUser();
    return subscribeToAuthChanges(syncUser);
  }, [syncUser]);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/seller/resale/listings?size=100", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load listings");
      setListings(data?.content || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  // Load unlisted authorizations for Create Listing modal
  const openCreateModal = async () => {
    setIsCreateOpen(true);
    setLoadingAuths(true);
    try {
      const res = await fetch("/api/v1/seller/resale/authorizations?activeOnly=true&size=100", {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        const authList: ActiveAuthorization[] = data?.content || [];
        // Filter out authorizations that already have a listing
        const existingAuthIds = new Set(listings.map((l) => l.authorizationId).filter(Boolean));
        const unlisted = authList.filter((a) => !existingAuthIds.has(a.id));
        setAuthorizations(unlisted);
        if (unlisted.length > 0) {
          setSelectedAuthId(unlisted[0].id);
          setCreateRetailPrice(
            unlisted[0].supplierProductPrice ? String(unlisted[0].supplierProductPrice * 1.25) : "29.99"
          );
        }
      }
    } catch {
      toast.error("Could not load authorized products");
    } finally {
      setLoadingAuths(false);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuthId) {
      toast.error("Please select an authorized Supplier product");
      return;
    }
    const priceNum = parseFloat(createRetailPrice);
    if (!priceNum || priceNum <= 0) {
      toast.error("Please enter a valid retail price");
      return;
    }

    setSubmittingCreate(true);
    try {
      const res = await fetch("/api/v1/seller/resale/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorizationId: selectedAuthId,
          customTitle: createCustomTitle.trim() || undefined,
          retailPrice: priceNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to create listing");
      }
      toast.success("Listing created successfully!");
      setIsCreateOpen(false);
      setCreateCustomTitle("");
      setCreateRetailPrice("");
      await loadListings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const openEditModal = (listing: Listing) => {
    setEditingListing(listing);
    setEditPrice(String(listing.retailPrice));
    setEditTitle(listing.customTitle || "");
    setEditActive(listing.active !== false);
  };

  const handleSaveEdit = async () => {
    if (!editingListing) return;
    const priceNum = parseFloat(editPrice);
    if (!priceNum || priceNum <= 0) {
      toast.error("Please enter a valid retail price");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/seller/resale/listings/${editingListing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailPrice: priceNum,
          customTitle: editTitle.trim() || undefined,
          active: editActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to update listing");
      }
      toast.success("Listing updated successfully");
      setEditingListing(null);
      await loadListings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleVisibility = async (listing: Listing) => {
    const nextState = !listing.active;
    try {
      const res = await fetch(`/api/v1/seller/resale/listings/${listing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailPrice: listing.retailPrice,
          active: nextState,
        }),
      });
      if (!res.ok) throw new Error("Failed to change visibility");
      toast.success(nextState ? "Listing activated on storefront" : "Listing hidden from storefront");
      await loadListings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  // Filter listings
  const filteredListings = useMemo(() => {
    let result = listings;
    if (filterStatus === "active") {
      result = result.filter((l) => l.active);
    } else if (filterStatus === "inactive") {
      result = result.filter((l) => !l.active);
    } else if (filterStatus === "out") {
      result = result.filter((l) => (l.remainingQuantity ?? 0) <= 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          (l.customTitle || "").toLowerCase().includes(q) ||
          (l.supplierProductName || "").toLowerCase().includes(q) ||
          (l.supplierProductId || "").toLowerCase().includes(q) ||
          (l.supplierDisplayName || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [listings, filterStatus, search]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Resale Store Listings</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadListings()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition"
          >
            <RotateCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={() => void openCreateModal()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" /> Create Listing
          </button>
          <Link
            href="/seller/supplier-catalog"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
          >
            Discover More
          </Link>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Listings</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {listings.filter((l) => l.active).length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Visible to online buyers</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Allocated Units</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {listings.reduce((acc, l) => acc + (l.allocatedQuantity ?? 0), 0).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">Total authorized inventory</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Units Sold</div>
          <div className="mt-2 text-2xl font-bold text-indigo-600">
            {listings.reduce((acc, l) => acc + (l.soldQuantity ?? 0), 0).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">Fulfilled through store</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available Sellable</div>
          <div className="mt-2 text-2xl font-bold text-indigo-700">
            {listings.reduce((acc, l) => acc + (l.remainingQuantity ?? 0), 0).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">Remaining before stockout</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search listings by title, original product, or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Status:</span>
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === "all" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({listings.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === "active" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("inactive")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === "inactive" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Inactive
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("out")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === "out" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Listings Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading store listings...</div>
        ) : filteredListings.length === 0 ? (
          <div className="p-12 text-center">
            <Store className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-2 text-sm font-semibold text-slate-700">No store listings found</h3>
            <p className="mt-1 text-xs text-slate-500">
              {listings.length === 0
                ? "You haven't created any resale listings yet. Create a listing from your approved Supplier partnerships!"
                : "No listings match your search or filter criteria."}
            </p>
            {listings.length === 0 && (
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void openCreateModal()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
                >
                  Create Your First Listing
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Storefront Item</th>
                  <th className="py-3 px-4">Supplier Partner</th>
                  <th className="py-3 px-4 text-center">Allocated</th>
                  <th className="py-3 px-4 text-center">Sold / Res</th>
                  <th className="py-3 px-4 text-center">Sellable</th>
                  <th className="py-3 px-4 text-center">Retail Price</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredListings.map((item) => {
                  const remaining = item.remainingQuantity ?? 0;
                  const isOut = remaining <= 0;
                  const isLow = !isOut && remaining <= 5;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolveImage(item.supplierProductImage)}
                            alt={item.customTitle || item.supplierProductName || item.supplierProductId}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-slate-50"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                            }}
                          />
                          <div>
                            <div className="font-semibold text-slate-900">
                              {item.customTitle || item.supplierProductName || item.supplierProductId}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Orig: {item.supplierProductName || item.supplierProductId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {item.supplierDisplayName || "Supplier"}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                        {item.allocatedQuantity ?? "—"}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-500 font-medium">
                        {item.soldQuantity ?? 0} <span className="text-slate-300">/</span> {item.reservedQuantity ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                            isOut
                              ? "bg-rose-100 text-rose-800"
                              : isLow
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {remaining}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900 text-sm">
                        ${Number(item.retailPrice).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {item.active ? "Active" : "Hidden"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailsListing(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                            title="View Full Specifications"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleVisibility(item)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              item.active
                                ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                            }`}
                          >
                            {item.active ? "Hide" : "Activate"}
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

      {/* Edit Listing Modal */}
      {editingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Store Listing</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Original: {editingListing.supplierProductName || editingListing.supplierProductId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Protected Supplier Information Banner */}
            <div className="rounded-lg bg-amber-50/70 p-3 border border-amber-200/80 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Protected Supplier Information</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Supplier: <span className="font-semibold">{editingListing.supplierDisplayName || "Supplier"}</span> · Wholesale Price:{" "}
                <span className="font-semibold">${editingListing.supplierWholesalePrice ?? "—"}</span>. You can only customize storefront pricing and title.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Storefront Retail Price ($)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Custom Storefront Title <span className="text-slate-400 font-normal">(optional presentation override)</span>
                </label>
                <input
                  type="text"
                  placeholder={editingListing.supplierProductName || "Leave blank to use original title"}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Storefront Visibility</div>
                  <div className="text-[11px] text-slate-500">Allow customers to discover and purchase this item</div>
                </div>
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                disabled={savingEdit}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {detailsListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Product & Allocation Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">Listing ID: {detailsListing.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsListing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Sections */}
            <div className="space-y-4">
              {/* 1. Original Supplier Section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Original Supplier Information
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Supplier:</span>{" "}
                    <span className="font-semibold text-slate-800">{detailsListing.supplierDisplayName || "Supplier"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Product ID:</span>{" "}
                    <span className="font-mono text-slate-800">{detailsListing.supplierProductId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Product Name:</span>{" "}
                    <span className="font-semibold text-slate-800">{detailsListing.supplierProductName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Wholesale Price:</span>{" "}
                    <span className="font-semibold text-slate-800">
                      {detailsListing.supplierWholesalePrice != null ? `$${detailsListing.supplierWholesalePrice.toFixed(2)}` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Seller Storefront Section */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                  Seller Storefront Settings
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Custom Title:</span>{" "}
                    <span className="font-semibold text-slate-800">{detailsListing.customTitle || "Using default"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Selling Price:</span>{" "}
                    <span className="font-bold text-indigo-900">${Number(detailsListing.retailPrice).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status:</span>{" "}
                    <span className="font-semibold text-emerald-700">{detailsListing.active ? "Active" : "Hidden"}</span>
                  </div>
                </div>
              </div>

              {/* 3. Inventory Allocation Section */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-xs">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Allocated Inventory Status
                </div>
                <div className="grid grid-cols-4 gap-2 text-center pt-1">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[10px] text-slate-400">Allocated</div>
                    <div className="text-base font-bold text-slate-900">{detailsListing.allocatedQuantity ?? "—"}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[10px] text-emerald-600">Sold</div>
                    <div className="text-base font-bold text-emerald-700">{detailsListing.soldQuantity ?? 0}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[10px] text-amber-600">Reserved</div>
                    <div className="text-base font-bold text-amber-700">{detailsListing.reservedQuantity ?? 0}</div>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-2">
                    <div className="text-[10px] text-indigo-700 font-semibold">Remaining</div>
                    <div className="text-base font-bold text-indigo-700">{detailsListing.remainingQuantity ?? "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailsListing(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Listing Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Listing from Approved Partnership</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Publish an authorized Supplier product to your storefront with your custom retail price.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingAuths ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading authorized products...</div>
            ) : authorizations.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <Store className="mx-auto h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-600">
                  No unlisted authorized products available. All your approved partnerships already have active listings, or you haven't had any requests approved yet.
                </p>
                <Link
                  href="/seller/supplier-catalog"
                  className="inline-block px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
                >
                  Find Products to Resell
                </Link>
              </div>
            ) : (
              <form onSubmit={handleCreateListing} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Select Approved Supplier Product
                  </label>
                  <select
                    value={selectedAuthId}
                    onChange={(e) => {
                      setSelectedAuthId(e.target.value);
                      const chosen = authorizations.find((a) => a.id === e.target.value);
                      if (chosen && chosen.supplierProductPrice) {
                        setCreateRetailPrice(String(chosen.supplierProductPrice * 1.25));
                      }
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {authorizations.map((auth) => (
                      <option key={auth.id} value={auth.id}>
                        {auth.supplierProductName || auth.supplierProductId} — Initial Allocation:{" "}
                        {auth.initialAllocationQuantity ?? "MOQ"} units (Wholesale: ${auth.supplierProductPrice ?? "—"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Retail Selling Price ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={createRetailPrice}
                    onChange={(e) => setCreateRetailPrice(e.target.value)}
                    placeholder="e.g. 49.99"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Recommended to mark up from the wholesale price to cover your store margin.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Custom Storefront Title <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={createCustomTitle}
                    onChange={(e) => setCreateCustomTitle(e.target.value)}
                    placeholder="Leave blank to use the Supplier's original product title"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    disabled={submittingCreate}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCreate}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    {submittingCreate ? "Creating..." : "Publish Listing"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
