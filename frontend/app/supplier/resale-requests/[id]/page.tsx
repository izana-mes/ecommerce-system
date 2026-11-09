"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaBan,
  FaUserCheck,
  FaStore,
  FaTag,
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
  updatedAt: string;
  minimumOrderQuantity?: number;
  availableInventory?: number;
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

export default function SupplierRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<ResaleRequest | null>(null);
  const [loading, setLoading] = useState(true);

  // Review state
  const [decisionNote, setDecisionNote] = useState("");
  const [initialAllocation, setInitialAllocation] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/supplier/resale/requests/${id}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        throw new Error("Failed to load request details");
      }
      const data = await res.json();
      setRequest(data);
      setInitialAllocation(String(data?.minimumOrderQuantity || 1));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading detail");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    loadDetail();
  }, [loadDetail, router]);

  const handleDecision = async (action: "approve" | "reject") => {
    if (action === "reject" && !decisionNote.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    const initialAllocationQuantity = Number(initialAllocation);
    if (action === "approve" && (!Number.isInteger(initialAllocationQuantity) || initialAllocationQuantity < (request?.minimumOrderQuantity || 1) || initialAllocationQuantity > (request?.availableInventory ?? Number.MAX_SAFE_INTEGER))) {
      toast.error("Initial allocation must meet MOQ and available inventory");
      return;
    }

    try {
      setProcessing(true);
      const res = await fetch(`/api/v1/supplier/resale/requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: decisionNote.trim() || undefined, ...(action === "approve" ? { initialAllocationQuantity } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Failed to ${action} request`);
      }
      toast.success(action === "approve" ? "Request approved!" : "Request rejected");
      loadDetail();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
          <p className="mt-2 text-sm text-slate-500">Loading request...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-900">Request Not Found</h2>
        <Link
          href="/supplier/resale-requests"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg"
        >
          <FaArrowLeft /> Back to Resale Requests
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <Link
            href="/supplier/resale-requests"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <FaArrowLeft /> Back to Resale Requests
          </Link>
          <span className="text-xs text-slate-400 font-mono">ID: {request.id}</span>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Review Resale Request</h1>
            <p className="text-xs text-slate-500 mt-1">
              Received on {new Date(request.createdAt).toLocaleString()}
            </p>
          </div>
          <div>
            {request.status === "APPROVED" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <FaCheckCircle /> Approved
              </span>
            )}
            {request.status === "REJECTED" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                <FaTimesCircle /> Rejected
              </span>
            )}
            {request.status === "PENDING" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                <FaClock /> Action Required
              </span>
            )}
            {request.status === "CANCELLED" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                <FaBan /> Cancelled by Seller
              </span>
            )}
          </div>
        </div>

        {/* Product & Seller Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Product</h2>
            <div className="flex items-start gap-4">
              <img
                src={resolveImage(request.supplierProductImage)}
                alt={request.supplierProductName || request.supplierProductId}
                className="w-20 h-20 object-cover rounded-xl border border-slate-200 bg-slate-50"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                }}
              />
              <div>
                <h3 className="font-bold text-slate-900">{request.supplierProductName}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {request.supplierProductId}</p>
                <p className="text-xs font-semibold text-slate-800 mt-1">
                  Catalog Price: ${request.supplierProductPrice?.toFixed(2) ?? "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Seller Snapshot */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requesting Seller</h2>
            <div className="space-y-1">
              <p className="text-base font-bold text-slate-900">{request.sellerDisplayName || "Seller"}</p>
              <p className="text-xs text-slate-500 font-mono">User ID: {request.sellerUserId}</p>
              <p className="text-xs text-slate-600">Email: {request.sellerEmail || "—"}</p>
            </div>
          </div>
        </div>

        {/* Seller Proposal */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Seller Proposal</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 block">Proposed Retail Price</span>
              <strong className="text-base text-slate-900">
                {request.proposedRetailPrice ? `$${Number(request.proposedRetailPrice).toFixed(2)}` : "None"}
              </strong>
            </div>
            <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 block">Message</span>
              <p className="text-xs text-slate-800 mt-0.5 italic">
                {request.proposalMessage ? `"${request.proposalMessage}"` : "No message provided"}
              </p>
            </div>
          </div>
        </div>

        {/* Action / Decision Panel */}
        {request.status === "PENDING" ? (
          <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Make Decision</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Reviewer Note / Feedback (Required if rejecting)
              </label>
              <textarea
                rows={4}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Enter feedback for the seller..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div><label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Initial Seller allocation</label><input type="number" min={request.minimumOrderQuantity || 1} max={request.availableInventory} value={initialAllocation} onChange={e=>setInitialAllocation(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/><p className="mt-1 text-xs text-slate-500">MOQ {request.minimumOrderQuantity || 1}; available inventory {request.availableInventory ?? "unknown"}.</p></div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleDecision("reject")}
                disabled={processing}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-60"
              >
                Reject Request
              </button>
              <button
                type="button"
                onClick={() => handleDecision("approve")}
                disabled={processing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-60"
              >
                Approve Request
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recorded Decision</h2>
            <p className="text-xs text-slate-500">
              Reviewed on: {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "—"}
            </p>
            {request.reviewerNote && (
              <p className="text-sm text-slate-800 p-3 bg-slate-50 rounded-lg">
                <strong>Note:</strong> {request.reviewerNote}
              </p>
            )}
            {request.cancelReason && (
              <p className="text-sm text-slate-800 p-3 bg-slate-50 rounded-lg">
                <strong>Seller cancellation reason:</strong> {request.cancelReason}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
