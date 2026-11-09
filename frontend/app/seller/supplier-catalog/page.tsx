"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";
import { FaSearch, FaFilter, FaStore, FaHandshake, FaCheckCircle, FaTimesCircle, FaClock, FaBoxOpen } from "react-icons/fa";
import { FiArrowLeft } from "react-icons/fi";

type SupplierCatalogProduct = {
  productId: string;
  supplierProductId?: string;
  productName: string;
  sku?: string;
  brand?: string;
  category?: string;
  productPrice?: number;
  wholesalePrice?: number;
  stockQuantity?: number;
  minimumOrderQuantity?: number;
  availableToSellers?: boolean;
  frontImg?: string;
  backImg?: string;
  productReviews?: string;
  active?: boolean;
  supplierUserId: string;
  supplierDisplayName?: string;
  commercialNote?: string;
  myRequestStatus?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | null;
  myRequestId?: string | null;
  hasActiveAuthorization?: boolean;
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

export default function SupplierCatalogForSellersPage() {
  const router = useRouter();
  const [products, setProducts] = useState<SupplierCatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [categories, setCategories] = useState<string[]>([]);

  // Request modal state
  const [selectedProduct, setSelectedProduct] = useState<SupplierCatalogProduct | null>(null);
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ size: "100", page: "0", sort: sortBy });
      if (search.trim()) params.set("q", search.trim());
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedSupplier !== "all") params.set("supplierUserId", selectedSupplier);
      const res = await fetch(`/api/v1/seller/resale/supplier-catalog?${params}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.status === 403) {
          toast.error("Seller account required");
          router.replace("/seller");
          return;
        }
        throw new Error("Failed to load supplier catalog");
      }
      const data = await res.json();
      const content: SupplierCatalogProduct[] = data?.content ?? (Array.isArray(data) ? data : []);
      setProducts(content);

      const cats = Array.from(
        new Set(content.map((p) => p.category?.trim()).filter((c): c is string => Boolean(c)))
      );
      setCategories(cats);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading catalog");
    } finally {
      setLoading(false);
    }
  }, [router, search, selectedCategory, selectedSupplier, sortBy]);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    loadCatalog();
  }, [loadCatalog, router]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      return selectedSupplier === "all" || p.supplierUserId === selectedSupplier;
    });
  }, [products, selectedSupplier]);

  const openRequestModal = (p: SupplierCatalogProduct) => {
    setSelectedProduct(p);
    setProposalMessage("");
    setProposedPrice(p.wholesalePrice ? String(p.wholesalePrice * 1.5) : "");
  };

  const closeRequestModal = () => {
    setSelectedProduct(null);
    setProposalMessage("");
    setProposedPrice("");
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      setSubmitting(true);
      const payload: Record<string, unknown> = {
        supplierProductId: selectedProduct.supplierProductId || selectedProduct.productId,
        proposalMessage: proposalMessage.trim() || undefined,
      };
      if (proposedPrice && !isNaN(Number(proposedPrice))) {
        payload.proposedRetailPrice = Number(proposedPrice);
      }

      const res = await fetch("/api/v1/seller/resale/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Failed to submit request");
      }

      toast.success("Resale request submitted successfully!");
      closeRequestModal();
      loadCatalog();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/seller"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
              >
                <FiArrowLeft /> Back to Seller Workspace
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">Supplier Product Catalog</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/seller/resale-requests"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition"
            >
              <FaClock className="text-amber-500" /> My Requests
            </Link>
            <Link
              href="/seller/partnerships"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition"
            >
              <FaHandshake /> Active Partnerships
            </Link>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, SKU, brand, or supplier..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <FaFilter className="text-slate-400 text-xs ml-1" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Categories ({products.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
              <option value="all">All Suppliers</option>
              {Array.from(new Map(products.map(p => [p.supplierUserId, p.supplierDisplayName || "Supplier"])).entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
              <option value="name">Sort: Name</option><option value="price">Sort: Price</option><option value="stock">Sort: Stock</option>
            </select>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm text-slate-500">Loading discoverable supplier products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 py-16 text-center px-4">
            <FaBoxOpen className="mx-auto text-4xl text-slate-300 mb-3" />
            <h3 className="text-lg font-semibold text-slate-800">No resale products found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              {search || selectedCategory !== "all"
                ? "No products matched your search or category filter. Try clearing filters."
                : "Suppliers have not yet enabled any products for resale discovery. Check back soon."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((p) => {
              const isAuthorized = Boolean(p.hasActiveAuthorization);
              const isPending = p.myRequestStatus === "PENDING";
              const isRejected = p.myRequestStatus === "REJECTED";

              return (
                <div
                  key={p.productId}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* Product Image */}
                    <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                      <img
                        src={resolveImage(p.frontImg)}
                        alt={p.productName}
                        className="object-cover w-full h-full hover:scale-105 transition duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                        }}
                      />
                      {p.category && (
                        <span className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur text-white text-xs px-2.5 py-1 rounded-full font-medium">
                          {p.category}
                        </span>
                      )}
                      {/* Status Badges */}
                      {isAuthorized && (
                        <span className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 shadow">
                          <FaCheckCircle className="text-xs" /> Authorized
                        </span>
                      )}
                      {isPending && (
                        <span className="absolute top-2.5 right-2.5 bg-amber-500 text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 shadow">
                          <FaClock className="text-xs" /> Request Pending
                        </span>
                      )}
                      {isRejected && !isPending && !isAuthorized && (
                        <span className="absolute top-2.5 right-2.5 bg-rose-600 text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 shadow">
                          <FaTimesCircle className="text-xs" /> Rejected
                        </span>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-mono">ID: {p.productId}</span>
                        <span>{p.productReviews || "Verified product"}</span>
                      </div>
                      <h3 className="font-semibold text-slate-900 line-clamp-1" title={p.productName}>
                        {p.productName}
                      </h3>
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <span className="text-xs text-slate-500">Wholesale price:</span>
                          <p className="text-lg font-bold text-slate-900">${p.wholesalePrice?.toFixed(2) ?? "—"}</p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600">SKU: {p.sku || "—"} · Brand: {p.brand || "—"}</div>
                      <div className="text-xs text-slate-600">Stock: {p.stockQuantity ?? 0} · MOQ: {p.minimumOrderQuantity ?? 1} · {p.stockQuantity && p.stockQuantity >= (p.minimumOrderQuantity || 1) ? "Available" : "Unavailable"}</div>

                      {/* Supplier Information */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1">
                          <FaStore className="text-slate-400" /> Supplied by:
                        </span>
                        <span className="font-medium text-slate-800">
                          {p.supplierDisplayName || "Verified Supplier"}
                        </span>
                      </div>

                      {p.commercialNote && (
                        <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-800">
                          <strong>Note:</strong> {p.commercialNote}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 pt-0">
                    {isAuthorized ? (
                      <Link
                        href="/seller/partnerships"
                        className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-100 transition"
                      >
                        <FaHandshake /> Create Storefront Listing
                      </Link>
                    ) : isPending ? (
                      <Link
                        href={`/seller/resale-requests/${p.myRequestId || ""}`}
                        className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100 transition"
                      >
                        <FaClock /> View Pending Request
                      </Link>
                    ) : (
                      <button
                        onClick={() => openRequestModal(p)}
                        disabled={!p.availableToSellers}
                        className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <FaHandshake /> {p.availableToSellers ? "Request to Sell" : "Currently Unavailable"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Request to Resell Product</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submit a partnership request directly to {selectedProduct.supplierDisplayName || "the Supplier"}.
                </p>
              </div>
              <button
                onClick={closeRequestModal}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                &times;
              </button>
            </div>

            {/* Product Snapshot */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <img
                src={resolveImage(selectedProduct.frontImg)}
                alt={selectedProduct.productName}
                className="w-14 h-14 object-cover rounded-lg border border-slate-200 bg-white"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-900 truncate">{selectedProduct.productName}</h4>
                <p className="text-xs text-slate-500 font-mono">ID: {selectedProduct.productId}</p>
                <p className="text-xs font-semibold text-slate-800">
                  Wholesale: ${selectedProduct.wholesalePrice?.toFixed(2) ?? "—"} · Stock: {selectedProduct.stockQuantity ?? 0} · MOQ: {selectedProduct.minimumOrderQuantity ?? 1}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Proposed Retail Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  placeholder="Required proposed retail price"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">Suggested initial retail price for your storefront.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Partnership Message / Proposal
                </label>
                <textarea
                  rows={4}
                  value={proposalMessage}
                  onChange={(e) => setProposalMessage(e.target.value)}
                  placeholder="Tell the supplier about your storefront, marketing channels, and why you are a good match to resell their product..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeRequestModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-60 flex items-center gap-2"
                >
                  {submitting ? "Submitting..." : "Send Resale Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
