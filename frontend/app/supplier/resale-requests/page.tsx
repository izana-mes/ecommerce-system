"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaBan,
  FaFilter,
  FaArrowLeft,
  FaUserCheck,
  FaHandshake,
  FaStore,
  FaGlobe,
  FaHistory,
} from "react-icons/fa";

type ResaleRequest = {
  id: string;
  supplierProductId: string;
  supplierProductName?: string;
  supplierProductImage?: string;
  supplierProductPrice?: number;
  sellerUserId: string;
  sellerDisplayName?: string;
  sellerEmail?: string;
  supplierUserId: string;
  proposalMessage?: string;
  proposedRetailPrice?: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewerNote?: string;
  reviewedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  minimumOrderQuantity?: number;
  availableInventory?: number;
};

type SellerProfile = {
  sellerId: string;
  storeName?: string;
  businessDescription?: string;
  websiteUrl?: string;
  memberSince?: string;
  emailVerified: boolean;
  activeListingCount: number;
  activePartnershipCount: number;
  totalRequestsSubmitted: number;
  previousRequests?: ResaleRequest[];
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

export default function SupplierResaleRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ResaleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<ResaleRequest | null>(null);
  const [reviewMode, setReviewMode] = useState<"ACCEPT" | "REJECT" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [initialAllocation, setInitialAllocation] = useState("");
  const [processing, setProcessing] = useState(false);

  // Seller Profile Modal State
  const [inspectSellerId, setInspectSellerId] = useState<string | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const url =
        statusFilter === "ALL"
          ? "/api/v1/supplier/resale/requests?size=100"
          : `/api/v1/supplier/resale/requests?status=${statusFilter}&size=100`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.status === 403) {
          toast.error("Supplier access required");
          router.replace("/supplier");
          return;
        }
        throw new Error("Failed to load resale requests");
      }
      const data = await res.json();
      setRequests(data?.content ?? (Array.isArray(data) ? data : []));
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

  const openReviewModal = (r: ResaleRequest, mode: "ACCEPT" | "REJECT") => {
    setSelectedRequest(r);
    setReviewMode(mode);
    setReviewNote("");
    setInitialAllocation(mode === "ACCEPT" ? String(r.minimumOrderQuantity || 1) : "");
  };

  const closeReviewModal = () => {
    setSelectedRequest(null);
    setReviewMode(null);
    setReviewNote("");
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !reviewMode) return;

    if (reviewMode === "REJECT" && !reviewNote.trim()) {
      toast.error("A reason is required when rejecting a request");
      return;
    }
    const initialAllocationQuantity = Number(initialAllocation);
    if (reviewMode === "ACCEPT" && (!Number.isInteger(initialAllocationQuantity) || initialAllocationQuantity < (selectedRequest.minimumOrderQuantity || 1) || initialAllocationQuantity > (selectedRequest.availableInventory ?? Number.MAX_SAFE_INTEGER))) {
      toast.error(`Allocation must be between MOQ ${selectedRequest.minimumOrderQuantity || 1} and available inventory ${selectedRequest.availableInventory ?? "—"}`);
      return;
    }

    try {
      setProcessing(true);
      const endpoint =
        reviewMode === "ACCEPT"
          ? `/api/v1/supplier/resale/requests/${selectedRequest.id}/approve`
          : `/api/v1/supplier/resale/requests/${selectedRequest.id}/reject`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reviewNote.trim() || undefined, ...(reviewMode === "ACCEPT" ? { initialAllocationQuantity } : {}) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Failed to ${reviewMode.toLowerCase()} request`);
      }

      toast.success(
        reviewMode === "ACCEPT"
          ? "Request approved and authorization granted!"
          : "Request rejected with explanation"
      );
      closeReviewModal();
      loadRequests();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleInspectSeller = async (sellerId: string) => {
    try {
      setInspectSellerId(sellerId);
      setLoadingProfile(true);
      setSellerProfile(null);
      const res = await fetch(`/api/v1/supplier/resale/sellers/${sellerId}/profile`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load seller profile");
      const data = await res.json();
      setSellerProfile(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load seller profile");
    } finally {
      setLoadingProfile(false);
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
            <FaClock className="text-xs" /> Pending Review
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
              href="/supplier"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
            >
              <FaArrowLeft /> Back to Supplier Portal
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">Incoming Resale Requests</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/supplier/partnerships"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition"
            >
              <FaHandshake /> Active Seller Partnerships
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
            <p className="mt-3 text-sm text-slate-500">Loading incoming requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 py-16 text-center px-4">
            <FaClock className="mx-auto text-4xl text-slate-300 mb-3" />
            <h3 className="text-lg font-semibold text-slate-800">No requests found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              There are currently no resale requests matching the &quot;{statusFilter}&quot; status filter.
            </p>
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
                        Requested by Seller:{" "}
                        <button
                          onClick={() => handleInspectSeller(r.sellerUserId)}
                          className="font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                        >
                          <FaUserCheck className="text-xs" /> {r.sellerDisplayName || "Seller"}
                        </button>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1.5">
                    {statusBadge(r.status)}
                    <span className="text-xs text-slate-400">
                      Received: {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
                  <div>
                    <span className="text-slate-500 block">Proposed Retail Price:</span>
                    <strong className="text-slate-800 text-sm">
                      {r.proposedRetailPrice ? `$${Number(r.proposedRetailPrice).toFixed(2)}` : "Not specified"}
                    </strong>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-500 block">Seller Proposal Message:</span>
                    <p className="text-slate-700 italic mt-0.5">
                      {r.proposalMessage ? `"${r.proposalMessage}"` : "No message provided"}
                    </p>
                  </div>
                </div>

                {/* Previous Note / Reason */}
                {r.reviewerNote && (
                  <div
                    className={`p-3 rounded-lg text-xs border ${
                      r.status === "APPROVED"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    <strong>Your Decision Note:</strong> {r.reviewerNote}
                  </div>
                )}

                {r.cancelReason && (
                  <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-700">
                    <strong>Seller Cancellation Reason:</strong> {r.cancelReason}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleInspectSeller(r.sellerUserId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    <FaUserCheck /> Inspect Seller Profile
                  </button>

                  <Link
                    href={`/supplier/resale-requests/${r.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Full Details
                  </Link>

                  {r.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => openReviewModal(r, "REJECT")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-300 bg-rose-50 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-100 transition"
                      >
                        <FaTimesCircle /> Reject Request
                      </button>
                      <button
                        onClick={() => openReviewModal(r, "ACCEPT")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 rounded-lg text-xs font-medium text-white hover:bg-emerald-700 transition"
                      >
                        <FaCheckCircle /> Approve Request
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal (Accept / Reject) */}
      {selectedRequest && reviewMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {reviewMode === "ACCEPT" ? "Accept Resale Request" : "Reject Resale Request"}
            </h3>
            <p className="text-xs text-slate-500">
              {reviewMode === "ACCEPT"
                ? `Grant permission to ${selectedRequest.sellerDisplayName || "Seller"} to resell ${
                    selectedRequest.supplierProductName || selectedRequest.supplierProductId
                  }.`
                : `Decline the request from ${selectedRequest.sellerDisplayName || "Seller"}. You must provide a clear reason.`}
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  {reviewMode === "ACCEPT" ? "Note to Seller (Optional)" : "Rejection Reason * (Required)"}
                </label>
                <textarea
                  rows={4}
                  required={reviewMode === "REJECT"}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    reviewMode === "ACCEPT"
                      ? "e.g. Welcome aboard! Minimum advertised price policy applies."
                      : "e.g. Exclusive distribution agreement currently in place for your region..."
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {reviewMode === "ACCEPT" ? <div><label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Initial Seller allocation</label><input required type="number" min={selectedRequest.minimumOrderQuantity || 1} max={selectedRequest.availableInventory} value={initialAllocation} onChange={e=>setInitialAllocation(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/><p className="mt-1 text-xs text-slate-500">MOQ {selectedRequest.minimumOrderQuantity || 1}; unreserved supplier inventory {selectedRequest.availableInventory ?? "unknown"}.</p></div> : null}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  disabled={processing}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`px-5 py-2 text-white text-xs font-medium rounded-lg shadow-sm transition ${
                    reviewMode === "ACCEPT"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {processing
                    ? "Processing..."
                    : reviewMode === "ACCEPT"
                    ? "Confirm Acceptance"
                    : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seller Profile Inspection Modal (Phase 5) */}
      {inspectSellerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FaStore className="text-indigo-600" /> Seller Business Profile
              </h3>
              <button
                onClick={() => setInspectSellerId(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {loadingProfile ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading seller profile...</div>
            ) : sellerProfile ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">{sellerProfile.storeName}</h4>
                    {sellerProfile.websiteUrl && (
                      <a
                        href={sellerProfile.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <FaGlobe className="text-[10px]" /> {sellerProfile.websiteUrl}
                      </a>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      Member since:{" "}
                      {sellerProfile.memberSince
                        ? new Date(sellerProfile.memberSince).toLocaleDateString()
                        : "Verified member"}
                    </p>
                  </div>
                  {sellerProfile.emailVerified && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <FaCheckCircle /> Verified Account
                    </span>
                  )}
                </div>

                {sellerProfile.businessDescription && (
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700">
                    <strong className="block text-slate-900 mb-0.5">Business Description:</strong>
                    {sellerProfile.businessDescription}
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xl font-bold text-slate-900">{sellerProfile.activeListingCount}</span>
                    <span className="text-[11px] text-slate-500 block">Active Listings</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xl font-bold text-indigo-600">{sellerProfile.activePartnershipCount}</span>
                    <span className="text-[11px] text-slate-500 block">Active Partnerships</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xl font-bold text-slate-700">{sellerProfile.totalRequestsSubmitted}</span>
                    <span className="text-[11px] text-slate-500 block">Total Requests</span>
                  </div>
                </div>

                {/* Previous Requests with this Supplier */}
                {sellerProfile.previousRequests && sellerProfile.previousRequests.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <FaHistory /> Request History with Your Catalog ({sellerProfile.previousRequests.length})
                    </h5>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {sellerProfile.previousRequests.map((pr) => (
                        <div
                          key={pr.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">{pr.supplierProductName || pr.supplierProductId}</span>
                            <span className="text-slate-400 block text-[10px]">
                              {new Date(pr.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {statusBadge(pr.status)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Could not load seller profile.</p>
            )}

            <div className="pt-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setInspectSellerId(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
