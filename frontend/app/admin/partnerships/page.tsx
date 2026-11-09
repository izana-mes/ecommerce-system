"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  Handshake,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Filter,
  ArrowLeft,
  ShieldCheck,
  Search,
  AlertTriangle,
  Store,
  Package,
  X,
  ExternalLink,
} from "lucide-react";

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
  supplierDisplayName?: string;
  proposalMessage?: string;
  proposedRetailPrice?: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewerNote?: string;
  reviewedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
};

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

const FALLBACK_IMAGE = "/Products/product_1.jpg";

function resolveImage(src?: string | null): string {
  const val = String(src ?? "").trim();
  if (!val) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(val) || val.startsWith("/") || val.startsWith("/Products/")) {
    return val;
  }
  return `/Products/${val}`;
}

export default function AdminPartnershipsPage() {
  const router = useRouter();
  const token = getUser();

  const [requests, setRequests] = useState<ResaleRequest[]>([]);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"requests" | "authorizations">("requests");

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  // Modal inspection
  const [selectedReq, setSelectedReq] = useState<ResaleRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) {
      router.replace("/login?returnTo=/admin/partnerships");
      return;
    }
    setLoading(true);
    try {
      const [reqRes, authRes] = await Promise.all([
        fetch("/api/v1/admin/resale/requests"),
        fetch("/api/v1/admin/resale/authorizations"),
      ]);

      if (!reqRes.ok || !authRes.ok) {
        throw new Error("Failed to load resale data");
      }

      const reqData = await reqRes.json();
      const authData = await authRes.json();

      setRequests(Array.isArray(reqData?.data) ? reqData.data : []);
      setAuthorizations(Array.isArray(authData?.data) ? authData.data : []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load partnerships");
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const reviewRequest = async (decision: "approve" | "reject") => {
    if (!selectedReq) return;
    if (decision === "reject" && !reviewNote.trim()) { toast.error("Enter a rejection reason"); return; }
    setReviewing(true);
    try {
      const response = await fetch(`/api/v1/admin/resale/requests/${selectedReq.id}/${decision}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: reviewNote.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || `Could not ${decision} request`);
      toast.success(decision === "approve" ? "Seller request approved" : "Seller request rejected");
      setSelectedReq(null);
      setReviewNote("");
      await loadData();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Review failed"); }
    finally { setReviewing(false); }
  };

  // Repeated rejections heuristic: identify if a seller has multiple rejections for the same product
  const sellerRejectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of requests) {
      if (r.status === "REJECTED") {
        const key = `${r.sellerUserId}:${r.supplierProductId}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const pName = (r.supplierProductName || "").toLowerCase();
        const sellerName = (r.sellerDisplayName || "").toLowerCase();
        const supName = (r.supplierDisplayName || "").toLowerCase();
        const prodId = (r.supplierProductId || "").toLowerCase();
        return pName.includes(q) || sellerName.includes(q) || supName.includes(q) || prodId.includes(q);
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  const filteredAuthorizations = useMemo(() => {
    return authorizations.filter((a) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const pName = (a.supplierProductName || "").toLowerCase();
        const sellerName = (a.sellerDisplayName || "").toLowerCase();
        const supName = (a.supplierDisplayName || "").toLowerCase();
        const prodId = (a.supplierProductId || "").toLowerCase();
        return pName.includes(q) || sellerName.includes(q) || supName.includes(q) || prodId.includes(q);
      }
      return true;
    });
  }, [authorizations, search]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={11} strokeWidth={2} />
            <span>Approved</span>
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={11} strokeWidth={2} />
            <span>Rejected</span>
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Ban size={11} strokeWidth={2} />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={11} strokeWidth={2} />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
            >
              <ArrowLeft size={14} />
              <span>Back to Admin Dashboard</span>
            </Link>
            <h1 className="text-xl font-semibold text-slate-900 mt-2 flex items-center gap-2">
              <ShieldCheck size={20} className="text-indigo-600" />
              <span>Supplier–Seller Partnership Monitoring</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Platform-wide audit trail for product resale requests, authorizations, and supplier–seller decisions
            </p>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block uppercase">Total Requests</span>
            <span className="text-2xl font-semibold text-slate-900 mt-1 block">{requests.length}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block uppercase">Pending Review</span>
            <span className="text-2xl font-semibold text-amber-700 mt-1 block">
              {requests.filter((r) => r.status === "PENDING").length}
            </span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block uppercase">Active Authorizations</span>
            <span className="text-2xl font-semibold text-emerald-700 mt-1 block">
              {authorizations.filter((a) => a.active).length}
            </span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block uppercase">Revoked Partnerships</span>
            <span className="text-2xl font-semibold text-rose-700 mt-1 block">
              {authorizations.filter((a) => !a.active).length}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => setActiveTab("requests")}
            className={`pb-3 font-medium text-xs transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "requests"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock size={14} />
            <span>All Resale Requests ({requests.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("authorizations")}
            className={`pb-3 font-medium text-xs transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "authorizations"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Handshake size={14} />
            <span>Authorizations & Partnerships ({authorizations.length})</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product, seller, supplier, or product ID..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {activeTab === "requests" && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter size={13} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          )}
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading resale partnership telemetry...
          </div>
        ) : activeTab === "requests" ? (
          filteredRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-500">
              No resale requests match the current filters.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-medium text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Supplier Product</th>
                    <th className="py-2.5 px-4">Requesting Seller</th>
                    <th className="py-2.5 px-4">Source Supplier</th>
                    <th className="py-2.5 px-4">Status & Risk</th>
                    <th className="py-2.5 px-4">Proposed Price</th>
                    <th className="py-2.5 px-4">Submitted</th>
                    <th className="py-2.5 px-4 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((r) => {
                    const rejCount = sellerRejectionCounts.get(`${r.sellerUserId}:${r.supplierProductId}`) || 0;
                    const repeatedRejections = rejCount > 1;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 flex items-center gap-3">
                          <img
                            src={resolveImage(r.supplierProductImage)}
                            alt={r.supplierProductName || r.supplierProductId}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-slate-50 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-xs">
                              {r.supplierProductName || r.supplierProductId}
                            </p>
                            <p className="text-slate-400 font-mono text-[10px]">ID: {r.supplierProductId}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{r.sellerDisplayName || "Seller"}</p>
                          <p className="text-slate-400 text-[10px] truncate max-w-[140px]">{r.sellerEmail || r.sellerUserId}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{r.supplierDisplayName || "Supplier"}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {statusBadge(r.status)}
                            {repeatedRejections && r.status === "REJECTED" && (
                              <span
                                title="Seller has received multiple rejections for this product"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
                              >
                                <AlertTriangle size={10} />
                                <span>Multiple Rejections</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {r.proposedRetailPrice ? `$${Number(r.proposedRetailPrice).toFixed(2)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedReq(r)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                          >
                            Inspect Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : filteredAuthorizations.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-500">
            No resale authorizations found.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-medium text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">Authorized Seller</th>
                  <th className="py-2.5 px-4">Source Supplier</th>
                  <th className="py-2.5 px-4">Authorization Status</th>
                  <th className="py-2.5 px-4">Granted Date</th>
                  <th className="py-2.5 px-4">Revocation Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuthorizations.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <img
                        src={resolveImage(a.supplierProductImage)}
                        alt={a.supplierProductName || a.supplierProductId}
                        className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-slate-50 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                        }}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate max-w-xs">{a.supplierProductName || a.supplierProductId}</p>
                        <p className="text-slate-400 font-mono text-[10px]">ID: {a.supplierProductId}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{a.sellerDisplayName || "Seller"}</p>
                      <p className="text-slate-400 text-[10px] truncate max-w-[140px]">{a.sellerUserId}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{a.supplierDisplayName || "Supplier"}</p>
                    </td>
                    <td className="py-3 px-4">
                      {a.active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <CheckCircle2 size={11} strokeWidth={2} />
                          <span>Active Partnership</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          <Ban size={11} strokeWidth={2} />
                          <span>Revoked</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{new Date(a.grantedAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {!a.active ? (
                        <div>
                          <p className="text-rose-700 font-medium">Revoked: {a.revokedAt ? new Date(a.revokedAt).toLocaleDateString() : "—"}</p>
                          <p className="text-slate-500 italic truncate max-w-xs">{a.revokeReason || "No reason recorded"}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Inspection Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-600" />
                <span>Resale Request Audit Detail</span>
              </h3>
              <button
                onClick={() => setSelectedReq(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Product</span>
                  <span className="font-medium text-slate-900 block mt-0.5">
                    {selectedReq.supplierProductName || selectedReq.supplierProductId}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Product ID</span>
                  <span className="font-mono text-slate-600 block mt-0.5">{selectedReq.supplierProductId}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Seller</span>
                  <span className="font-medium text-slate-900 block mt-0.5">
                    {selectedReq.sellerDisplayName || "Seller"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Supplier</span>
                  <span className="font-medium text-slate-900 block mt-0.5">
                    {selectedReq.supplierDisplayName || "Supplier"}
                  </span>
                </div>
              </div>

              {selectedReq.proposalMessage && (
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                    Seller Proposal Message
                  </span>
                  <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 italic">
                    &ldquo;{selectedReq.proposalMessage}&rdquo;
                  </p>
                </div>
              )}

              {selectedReq.reviewerNote && (
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                    Supplier Decision Explanation
                  </span>
                  <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800">
                    {selectedReq.reviewerNote}
                  </p>
                </div>
              )}

              {selectedReq.cancelReason && (
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                    Seller Cancellation Reason
                  </span>
                  <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800">
                    {selectedReq.cancelReason}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              {selectedReq.status === "PENDING" && <div className="mr-auto flex flex-1 items-center gap-2">
                <input value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Admin review note (required for rejection)" className="min-w-0 flex-1 rounded border px-2 py-1.5 text-xs" />
                <button disabled={reviewing} onClick={() => void reviewRequest("approve")} className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">Approve</button>
                <button disabled={reviewing || !reviewNote.trim()} onClick={() => void reviewRequest("reject")} className="rounded bg-rose-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">Reject</button>
              </div>}
              <button
                onClick={() => setSelectedReq(null)}
                className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
