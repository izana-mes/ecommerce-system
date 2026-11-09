"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";
import { FaClock, FaCheckCircle, FaTimesCircle, FaBan, FaFilter, FaArrowLeft, FaEye, FaHandshake } from "react-icons/fa";

type ResaleRequest = {
  id: string;
  supplierProductId: string;
  supplierProductName?: string;
  supplierProductImage?: string;
  supplierProductPrice?: number;
  sellerUserId: string;
  sellerDisplayName?: string;
  supplierUserId: string;
  supplierDisplayName?: string;
  proposalMessage?: string;
  proposedRetailPrice?: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewerNote?: string;
  reviewedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  initialAllocationQuantity?: number;
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

export default function SellerResaleRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ResaleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const url =
        statusFilter === "ALL"
          ? "/api/v1/seller/resale/requests?size=100"
          : `/api/v1/seller/resale/requests?status=${statusFilter}&size=100`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        throw new Error("Failed to load resale requests");
      }
      const data = await res.json();
      const content = data?.content ?? (Array.isArray(data) ? data : []);
      setRequests(content);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading requests");
    } finally {
      setLoading(false);
    }
  }, [router, statusFilter]);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    loadRequests();
  }, [loadRequests, router]);

  const handleOpenCancel = (id: string) => {
    setCancellingId(id);
    setCancelReason("");
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingId) return;
    try {
      const query = cancelReason.trim() ? `?reason=${encodeURIComponent(cancelReason.trim())}` : "";
      const res = await fetch(`/api/v1/seller/resale/requests/${cancellingId}${query}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to cancel request");
      }
      toast.success("Request cancelled");
      setShowCancelModal(false);
      setCancellingId(null);
      loadRequests();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Cancellation failed");
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <FaCheckCircle className="text-xs" /> Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <FaTimesCircle className="text-xs" /> Rejected
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <FaBan className="text-xs" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <FaClock className="text-xs" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <Link
              href="/seller"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
            >
              <FaArrowLeft /> Back to Seller Workspace
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">My Resale Requests</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/seller/supplier-catalog"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition"
            >
              Find More Products to Sell
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaFilter className="text-slate-400 text-xs" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Status:</span>
            {["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  statusFilter === st
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500 font-medium">Total: {requests.length}</span>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm text-slate-500">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 py-16 text-center px-4">
            <FaClock className="mx-auto text-4xl text-slate-300 mb-3" />
            <h3 className="text-lg font-semibold text-slate-800">No requests found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
              You haven&apos;t submitted any resale requests matching this filter.
            </p>
            <Link
              href="/seller/supplier-catalog"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition"
            >
              Browse Supplier Catalog
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={resolveImage(r.supplierProductImage)}
                      alt={r.supplierProductName || r.supplierProductId}
                      className="w-16 h-16 object-cover rounded-lg border border-slate-200 bg-slate-50"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                      }}
                    />
                    <div>
                      <h3 className="font-semibold text-slate-900 text-base">
                        {r.supplierProductName || `Product ${r.supplierProductId}`}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {r.supplierProductId}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Supplier: <strong className="text-slate-800">{r.supplierDisplayName || "Supplier"}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1.5">
                    {statusBadge(r.status)}
                    <span className="text-xs text-slate-400">
                      Submitted: {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
                  {r.status === "APPROVED" ? <div><span className="text-slate-500 block">Initial allocation:</span><strong className="text-emerald-700 text-sm">{r.initialAllocationQuantity ?? "Pending listing setup"} units</strong></div> : null}
                  <div>
                    <span className="text-slate-500 block">Proposed Retail Price:</span>
                    <strong className="text-slate-800 text-sm">
                      {r.proposedRetailPrice ? `$${Number(r.proposedRetailPrice).toFixed(2)}` : "Not specified"}
                    </strong>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-500 block">Proposal Message:</span>
                    <p className="text-slate-700 italic mt-0.5">
                      {r.proposalMessage ? `"${r.proposalMessage}"` : "No message provided"}
                    </p>
                  </div>
                </div>

                {/* Feedback / Reviewer Section */}
                {r.reviewerNote && (
                  <div
                    className={`p-3 rounded-lg text-xs border ${
                      r.status === "APPROVED"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    <strong>Supplier Feedback:</strong> {r.reviewerNote}
                  </div>
                )}

                {r.cancelReason && (
                  <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-700">
                    <strong>Cancellation Reason:</strong> {r.cancelReason}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <Link
                    href={`/seller/resale-requests/${r.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    <FaEye /> Full Details
                  </Link>

                  {r.status === "PENDING" && (
                    <button
                      onClick={() => handleOpenCancel(r.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 bg-rose-50 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-100 transition"
                    >
                      <FaBan /> Cancel Request
                    </button>
                  )}

                  {r.status === "APPROVED" && (
                    <Link
                      href="/seller/partnerships"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 rounded-lg text-xs font-medium text-white hover:bg-emerald-700 transition"
                    >
                      <FaHandshake /> Create Storefront Listing
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Cancel Resale Request</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to cancel this pending request? The supplier will be notified.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for cancellation (optional):
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Changed business plan, no longer stocking this line..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Keep Request
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
