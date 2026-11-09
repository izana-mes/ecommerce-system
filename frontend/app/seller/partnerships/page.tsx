"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  FaHandshake,
  FaCheckCircle,
  FaBan,
  FaArrowLeft,
  FaPlus,
  FaStore,
  FaTag,
  FaExternalLinkAlt,
} from "react-icons/fa";

type Authorization = {
  id: string;
  resaleRequestId: string;
  supplierProductId: string;
  supplierProductName?: string;
  supplierProductImage?: string;
  supplierProductPrice?: number;
  sellerUserId: string;
  sellerDisplayName?: string;
  supplierUserId: string;
  supplierDisplayName?: string;
  grantedAt: string;
  active: boolean;
  revokedAt?: string;
  revokeReason?: string;
  createdAt: string;
};

type SellerListing = {
  id: string;
  authorizationId: string;
  supplierProductId: string;
  supplierProductName?: string;
  supplierProductImage?: string;
  sellerUserId: string;
  customTitle?: string;
  retailPrice: number;
  active: boolean;
  createdAt: string;
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

export default function SellerPartnershipsPage() {
  const router = useRouter();
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Listing Modal
  const [selectedAuth, setSelectedAuth] = useState<Authorization | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [authRes, listRes] = await Promise.all([
        fetch("/api/v1/seller/resale/authorizations?size=100", { cache: "no-store" }),
        fetch("/api/v1/seller/resale/listings?size=100", { cache: "no-store" }),
      ]);

      if (!authRes.ok || !listRes.ok) {
        if (authRes.status === 401 || listRes.status === 401) {
          router.replace("/login");
          return;
        }
        throw new Error("Failed to load partnerships");
      }

      const authData = await authRes.json();
      const listData = await listRes.json();

      setAuthorizations(authData?.content ?? (Array.isArray(authData) ? authData : []));
      setListings(listData?.content ?? (Array.isArray(listData) ? listData : []));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    loadData();
  }, [loadData, router]);

  const openCreateListing = (auth: Authorization) => {
    setSelectedAuth(auth);
    setCustomTitle(auth.supplierProductName || "");
    setRetailPrice(auth.supplierProductPrice ? String(auth.supplierProductPrice) : "");
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuth) return;

    if (!retailPrice || isNaN(Number(retailPrice)) || Number(retailPrice) <= 0) {
      toast.error("Please enter a valid positive retail price");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/v1/seller/resale/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorizationId: selectedAuth.id,
          retailPrice: Number(retailPrice),
          customTitle: customTitle.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Failed to create listing");
      }

      toast.success("Storefront listing created successfully!");
      setSelectedAuth(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create listing");
    } finally {
      setCreating(false);
    }
  };

  const user = getUser();

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <Link
              href="/seller"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
            >
              <FaArrowLeft /> Back to Seller Workspace
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">Active Seller Partnerships</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/seller/supplier-catalog"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition"
            >
              Find More Products to Sell
            </Link>
            {user?.id && (
              <Link
                href={`/store/${user.id}`}
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition"
              >
                <FaStore /> View Storefront <FaExternalLinkAlt className="text-xs" />
              </Link>
            )}
          </div>
        </div>

        {/* Section 1: Resale Authorizations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FaHandshake className="text-indigo-600" /> Authorized Supplier Products ({authorizations.length})
            </h2>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading partnerships...</div>
          ) : authorizations.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 py-12 text-center px-4">
              <p className="text-sm text-slate-500">
                You do not have any accepted resale partnerships yet.
              </p>
              <Link
                href="/seller/supplier-catalog"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg"
              >
                Browse Supplier Catalog
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {authorizations.map((auth) => {
                const hasListing = listings.some(
                  (l) => l.supplierProductId === auth.supplierProductId
                );

                return (
                  <div
                    key={auth.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-4">
                      <img
                        src={resolveImage(auth.supplierProductImage)}
                        alt={auth.supplierProductName || auth.supplierProductId}
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 bg-slate-50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {auth.supplierProductName || auth.supplierProductId}
                          </h3>
                          {auth.active ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <FaCheckCircle className="text-xs" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                              <FaBan className="text-xs" /> Revoked
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {auth.supplierProductId}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          Supplier: <strong>{auth.supplierDisplayName || "Supplier"}</strong>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Authorized on: {new Date(auth.grantedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {!auth.active && auth.revokeReason && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                        <strong>Revocation reason:</strong> {auth.revokeReason}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      {auth.active ? (
                        hasListing ? (
                          <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                            <FaCheckCircle /> Storefront Listing Created
                          </span>
                        ) : (
                          <button
                            onClick={() => openCreateListing(auth)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
                          >
                            <FaPlus /> Create Storefront Listing
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-slate-400 italic">Authorization is inactive</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Storefront Listings */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FaTag className="text-emerald-600" /> Your Resale Storefront Listings ({listings.length})
          </h2>

          {listings.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
              No storefront listings created yet. Click &quot;Create Storefront Listing&quot; on an active partnership above.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Storefront Title</th>
                    <th className="py-3 px-4">Retail Price</th>
                    <th className="py-3 px-4">Listing Status</th>
                    <th className="py-3 px-4">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listings.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 flex items-center gap-3">
                        <img
                          src={resolveImage(l.supplierProductImage)}
                          alt={l.supplierProductName || l.supplierProductId}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-slate-50"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                          }}
                        />
                        <div>
                          <p className="font-semibold text-slate-900">{l.supplierProductName || l.supplierProductId}</p>
                          <p className="text-slate-400 font-mono text-[10px]">ID: {l.supplierProductId}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {l.customTitle || l.supplierProductName || "Standard Title"}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">${l.retailPrice.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        {l.active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            Inactive / Revoked
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Listing Modal */}
      {selectedAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create Storefront Listing</h3>
            <p className="text-xs text-slate-500">
              Create your commercial listing for <strong>{selectedAuth.supplierProductName || selectedAuth.supplierProductId}</strong>.
            </p>

            <form onSubmit={handleCreateListing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Custom Storefront Title (optional)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Special Edition Organic Coffee"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Retail Price ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Supplier base price: ${selectedAuth.supplierProductPrice?.toFixed(2) ?? "—"}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedAuth(null)}
                  disabled={creating}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
                >
                  {creating ? "Creating..." : "Publish Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
