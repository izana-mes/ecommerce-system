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
  FaHandshake,
  FaStore,
  FaShieldAlt,
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
  updatedAt: string;
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

export default function SellerRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<ResaleRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/seller/resale/requests/${id}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        throw new Error("Failed to load request details");
      }
      const data = await res.json();
      setRequest(data);
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

  const handleCancel = async () => {
    try {
      const query = cancelReason.trim() ? `?reason=${encodeURIComponent(cancelReason.trim())}` : "";
      const res = await fetch(`/api/v1/seller/resale/requests/${id}${query}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to cancel request");
      }
      toast.success("Request cancelled successfully");
      setShowCancelModal(false);
      loadDetail();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Cancellation failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
          <p className="mt-2 text-sm text-slate-500">Loading request details...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-900">Request Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">The requested resale submission could not be retrieved.</p>
        <Link
          href="/seller/resale-requests"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg"
        >
          <FaArrowLeft /> Back to My Requests
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
            href="/seller/resale-requests"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <FaArrowLeft /> Back to My Requests
          </Link>
          <span className="text-xs text-slate-400 font-mono">ID: {request.id}</span>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Resale Request Status</h1>
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
                  <FaClock /> Pending Supplier Review
                </span>
              )}
              {request.status === "CANCELLED" && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  <FaBan /> Cancelled by You
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Submitted on {new Date(request.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {request.status === "PENDING" && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-medium rounded-lg transition"
              >
                Cancel Request
              </button>
            )}
            {request.status === "APPROVED" && (
              <Link
                href="/seller/partnerships"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
              >
                <FaHandshake /> Go to Active Partnerships
              </Link>
            )}
          </div>
        </div>

        {/* Product Snapshot */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Product Information</h2>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <img
              src={resolveImage(request.supplierProductImage)}
              alt={request.supplierProductName || request.supplierProductId}
              className="w-24 h-24 object-cover rounded-xl border border-slate-200 bg-slate-50"
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
              }}
            />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                {request.supplierProductName || `Product ${request.supplierProductId}`}
              </h3>
              <p className="text-xs text-slate-500 font-mono">Product ID: {request.supplierProductId}</p>
              <p className="text-xs text-slate-600">
                Supplier Price: <strong className="text-slate-800">${request.supplierProductPrice?.toFixed(2) ?? "—"}</strong>
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs text-slate-600">
                <FaStore className="text-slate-400" />
                <span>Supplier: <strong>{request.supplierDisplayName || "Supplier"}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Submission Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Your Proposal</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">Proposed Retail Price</span>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {request.proposedRetailPrice ? `$${Number(request.proposedRetailPrice).toFixed(2)}` : "None"}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">Submitted By</span>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {request.sellerDisplayName || "You"}
              </p>
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-500 block mb-1">Partnership Message</span>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-800 whitespace-pre-wrap">
              {request.proposalMessage || "No message was provided with this request."}
            </div>
          </div>
        </div>

        {/* Supplier Decision Section */}
        {(request.reviewedAt || request.reviewerNote) && (
          <div
            className={`rounded-2xl border p-6 shadow-sm space-y-3 ${
              request.status === "APPROVED"
                ? "bg-emerald-50/50 border-emerald-200"
                : "bg-rose-50/50 border-rose-200"
            }`}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
              Supplier Decision & Feedback
            </h2>
            <div className="text-xs text-slate-500">
              Reviewed on: {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "—"}
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-sm text-slate-800">
              <strong>Reviewer Note:</strong> {request.reviewerNote || "No specific note provided."}
            </div>
          </div>
        )}

        {/* Cancellation Section */}
        {request.status === "CANCELLED" && (
          <div className="bg-slate-100 rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">Cancellation Record</h2>
            <p className="text-xs text-slate-500">
              Cancelled on: {request.cancelledAt ? new Date(request.cancelledAt).toLocaleString() : "—"}
            </p>
            {request.cancelReason && (
              <p className="text-sm text-slate-700 mt-2">
                <strong>Reason:</strong> {request.cancelReason}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Cancel Request</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to cancel this pending resale request?
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for cancellation (optional):
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                No, Keep
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
              >
                Cancel Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
