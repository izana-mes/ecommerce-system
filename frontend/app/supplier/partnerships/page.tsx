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
  FaShieldAlt,
  FaUserCheck,
  FaClock,
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
  sellerEmail?: string;
  supplierUserId: string;
  grantedAt: string;
  active: boolean;
  revokedAt?: string;
  revokeReason?: string;
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

export default function SupplierPartnershipsPage() {
  const router = useRouter();
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);

  // Revoke modal state
  const [selectedAuth, setSelectedAuth] = useState<Authorization | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const url = `/api/v1/supplier/resale/authorizations?activeOnly=${activeOnly}&size=100`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        throw new Error("Failed to load seller partnerships");
      }
      const data = await res.json();
      setAuthorizations(data?.content ?? (Array.isArray(data) ? data : []));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [activeOnly, router]);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    loadData();
  }, [loadData, router]);

  const openRevokeModal = (auth: Authorization) => {
    setSelectedAuth(auth);
    setRevokeReason("");
  };

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuth) return;

    if (!revokeReason.trim()) {
      toast.error("A reason is mandatory when revoking authorization");
      return;
    }

    try {
      setRevoking(true);
      const res = await fetch(`/api/v1/supplier/resale/authorizations/${selectedAuth.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revokeReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Failed to revoke authorization");
      }
      toast.success("Resale authorization revoked");
      setSelectedAuth(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Revocation failed");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <Link
              href="/supplier"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
            >
              <FaArrowLeft /> Back to Supplier Portal
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">Active Seller Partnerships</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/supplier/resale-requests"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition"
            >
              <FaClock className="text-amber-500" /> Incoming Requests
            </Link>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              Show Active Partnerships Only
            </label>
          </div>
          <span className="text-xs text-slate-500 font-medium">Total: {authorizations.length}</span>
        </div>

        {/* Partnerships List */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm text-slate-500">Loading partnerships...</p>
          </div>
        ) : authorizations.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 py-16 text-center px-4">
            <FaHandshake className="mx-auto text-4xl text-slate-300 mb-3" />
            <h3 className="text-lg font-semibold text-slate-800">No partnerships found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              No seller partnerships match your current filter. Accepted resale requests will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {authorizations.map((auth) => (
              <div
                key={auth.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
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
                    <p className="text-xs text-slate-700 mt-1">
                      Authorized Seller:{" "}
                      <strong className="text-indigo-600">{auth.sellerDisplayName || "Seller"}</strong>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Granted on: {new Date(auth.grantedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {!auth.active && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <strong>Revoked on:</strong>
                      <span>{auth.revokedAt ? new Date(auth.revokedAt).toLocaleDateString() : "—"}</span>
                    </div>
                    <p>
                      <strong>Reason:</strong> {auth.revokeReason || "No explanation provided"}
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                  {auth.active ? (
                    <button
                      onClick={() => openRevokeModal(auth)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 bg-rose-50 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-100 transition"
                    >
                      <FaBan /> Revoke Authorization
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Partnership inactive</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoke Modal */}
      {selectedAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Revoke Resale Authorization</h3>
            <p className="text-xs text-slate-500">
              Revoking authorization will immediately deactivate any storefront listings created by{" "}
              <strong>{selectedAuth.sellerDisplayName || "the seller"}</strong> for this product. Existing orders
              will remain intact.
            </p>

            <form onSubmit={handleRevoke} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Reason for Revocation * (Mandatory)
                </label>
                <textarea
                  rows={4}
                  required
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Explain why this resale authorization is being revoked (e.g. breach of commercial terms, end of partnership)..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedAuth(null)}
                  disabled={revoking}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revoking}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
                >
                  {revoking ? "Revoking..." : "Confirm Revocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
