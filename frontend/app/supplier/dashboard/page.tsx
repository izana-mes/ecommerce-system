"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { getUser } from "@/lib/auth";
import RoleAssistantLauncher from "@/components/management/RoleAssistantLauncher";
import {
  AlertTriangle,
  Package,
  Layers,
  DollarSign,
  Inbox,
  Handshake,
  UploadCloud,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Factory,
} from "lucide-react";

type TopProduct = { productId: string; productName: string; soldQty: number; revenue: number };

type RestockSuggestion = {
  productId: string;
  productName: string;
  stockQuantity: number;
  soldLast30Days: number;
  daysOfCover: number;
  urgency: "critical" | "high" | "medium" | "watch";
};

type DashboardData = {
  totalRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  avgStockPerProduct: number;
  availableBalance: number;
  pendingBalance: number;
  topSellingProducts: TopProduct[];
  restockSuggestions: RestockSuggestion[];
};

type ResaleStats = {
  pendingRequests: number;
  activePartnerships: number;
};

type ModerationStats = {
  pendingApproval: number;
  approved: number;
};
type ProductOpsStats = { products: number; active: number; resale: number; allocated: number; unallocated: number };

function UrgencyBadge({ urgency }: { urgency: RestockSuggestion["urgency"] }) {
  switch (urgency) {
    case "critical":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
          Critical
        </span>
      );
    case "high":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          High
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
          Medium
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
          Watch
        </span>
      );
  }
}

export default function SupplierDashboardPage() {
  const token = getUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [resaleStats, setResaleStats] = useState<ResaleStats>({ pendingRequests: 0, activePartnerships: 0 });
  const [modStats, setModStats] = useState<ModerationStats>({ pendingApproval: 0, approved: 0 });
  const [productOps, setProductOps] = useState<ProductOpsStats>({ products: 0, active: 0, resale: 0, allocated: 0, unallocated: 0 });
  const [loading, setLoading] = useState(true);
  const [operatingMode, setOperatingMode] = useState<"SUPPLY_ONLY" | "SUPPLY_AND_SELL">("SUPPLY_ONLY");
  const [savingMode, setSavingMode] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/v1/supplier/dashboard?days=30&lowStockThreshold=8", {
        headers: {},
      });
      const res = await response.json();
      if (!response.ok) throw new Error(res?.message || "Failed to load supplier dashboard");
      setData(res.data);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load supplier dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchAuxiliary = useCallback(async () => {
    if (!token) return;
    try {
      // 1. Resale requests to supplier
      const reqRes = await fetch("/api/v1/supplier/resale/requests");
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        const items = Array.isArray(reqData?.content) ? reqData.content : (Array.isArray(reqData?.data) ? reqData.data : (Array.isArray(reqData) ? reqData : []));
        const pendingCount = items.filter((x: { status?: string }) => x.status === "PENDING").length;
        setResaleStats((prev) => ({ ...prev, pendingRequests: pendingCount }));
      }

      // 2. Resale authorizations
      const authRes = await fetch("/api/v1/supplier/resale/authorizations");
      if (authRes.ok) {
        const authData = await authRes.json();
        const items = Array.isArray(authData?.content) ? authData.content : (Array.isArray(authData?.data) ? authData.data : (Array.isArray(authData) ? authData : []));
        const activeCount = items.filter((x: { active?: boolean }) => x.active !== false).length;
        setResaleStats((prev) => ({ ...prev, activePartnerships: activeCount }));
      }

      // 3. Product moderation
      const modRes = await fetch("/api/products/change-requests/mine");
      if (modRes.ok) {
        const modData = await modRes.json();
        const items = Array.isArray(modData) ? modData : modData?.data || [];
        const p = items.filter((x: { status?: string }) => x.status === "PENDING").length;
        const app = items.filter((x: { status?: string }) => x.status === "APPROVED").length;
        setModStats({ pendingApproval: p, approved: app });
      }

      const [offerRes, allocationRes] = await Promise.all([fetch("/api/v1/supplier/products/mine"), fetch("/api/v1/supplier/resale/allocations")]);
      if (offerRes.ok && allocationRes.ok) {
        const offers = await offerRes.json(); const allocations = await allocationRes.json();
        const offerRows = Array.isArray(offers) ? offers : []; const allocationRows = Array.isArray(allocations) ? allocations : [];
        const byProduct = new Map<string,number>(); allocationRows.forEach((a:{productId:string;allocated:number;sold:number})=>byProduct.set(a.productId,(byProduct.get(a.productId)||0)+Math.max(0,a.allocated-a.sold)));
        setProductOps({products:offerRows.length,active:offerRows.filter((o:{approved:boolean;available:boolean})=>o.approved&&o.available).length,resale:offerRows.filter((o:{allowResale?:boolean})=>o.allowResale).length,allocated:allocationRows.reduce((s:number,a:{allocated:number})=>s+a.allocated,0),unallocated:offerRows.reduce((s:number,o:{productId:string;stockQuantity:number;reservedQuantity:number})=>s+Math.max(0,o.stockQuantity-o.reservedQuantity-(byProduct.get(o.productId)||0)),0)});
      }
    } catch {
      // Non-blocking auxiliary fetch
    }
  }, [token]);

  useEffect(() => {
    void fetchDashboard();
    void fetchAuxiliary();
    fetch("/api/v1/supplier/resale/operating-mode", { cache: "no-store" }).then(async r => {
      if (r.ok) { const body = await r.json(); setOperatingMode(body.operatingMode || "SUPPLY_ONLY"); }
    }).catch(() => undefined);
  }, [fetchDashboard, fetchAuxiliary]);

  const changeOperatingMode = async (mode: "SUPPLY_ONLY" | "SUPPLY_AND_SELL") => {
    setSavingMode(true);
    try {
      const response = await fetch("/api/v1/supplier/resale/operating-mode", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operatingMode: mode }) });
      if (!response.ok) throw new Error("Could not save Supplier operating mode");
      setOperatingMode(mode);
      toast.success("Operating mode updated");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save mode"); }
    finally { setSavingMode(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* ── Header ── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h2 className="font-semibold text-slate-900">Supplier operating mode</h2><p className="text-sm text-slate-500">Direct retail is opt-in and separate from wholesale supply.</p></div>
        <select aria-label="Supplier operating mode" disabled={savingMode} value={operatingMode} onChange={e => void changeOperatingMode(e.target.value as "SUPPLY_ONLY" | "SUPPLY_AND_SELL")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="SUPPLY_ONLY">Supply only</option><option value="SUPPLY_AND_SELL">Supply and sell directly</option>
        </select>
      </section>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Supplier Dashboard</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/supplier"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <span>Manage Catalog</span>
            <ArrowUpRight size={14} className="text-slate-400" />
          </Link>
          <Link
            href="/supplier/resale-requests"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Inbox size={14} />
            <span>Review Requests</span>
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[["Products",productOps.products],["Active offers",productOps.active],["Resale enabled",productOps.resale],["Allocated units",productOps.allocated],["Unallocated units",productOps.unallocated]].map(([label,value])=><div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold text-slate-900">{value}</div></div>)}</section>

      {/* ── KPI Metric Cards ── */}
      {loading ? (
        <div className="management-kpi-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200/80 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Out of Stock */}
          <div className="management-kpi bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Out of Stock SKUs</span>
              <AlertTriangle size={16} strokeWidth={1.75} className="text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight">
              {data.outOfStockCount}
            </div>
            <div className="text-[11px] mt-1">
              {data.outOfStockCount > 0 ? (
                <span className="text-rose-600 font-medium">Restock required immediately</span>
              ) : (
                <span className="text-emerald-600 font-medium">All SKUs in stock</span>
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="management-kpi bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Low Stock SKUs</span>
              <Layers size={16} strokeWidth={1.75} className="text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight">
              {data.lowStockCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              <span>Threshold: &le; 8 units remaining</span>
            </div>
          </div>

          {/* Avg Stock / SKU */}
          <div className="management-kpi bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Avg Units / SKU</span>
              <Package size={16} strokeWidth={1.75} className="text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight">
              {data.avgStockPerProduct.toFixed(1)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              <span>Across {data.totalProducts} registered products</span>
            </div>
          </div>

          {/* Wholesale Revenue */}
          <div className="management-kpi bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Wholesale Revenue (30d)</span>
              <DollarSign size={16} strokeWidth={1.75} className="text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight">
              ${data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              <span>{data.totalOrders} total wholesale orders</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Resale & Catalog Moderation Hub ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Incoming Resale Requests */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Inbox size={16} className="text-teal-600" />
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Seller Resale Proposals
              </h2>
            </div>
            <Link
              href="/supplier/resale-requests"
              className="text-xs text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-0.5"
            >
              <span>Manage requests</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Link
              href="/supplier/resale-requests"
              className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:bg-slate-100/70 transition-colors block"
            >
              <span className="text-[11px] font-medium text-slate-500 block">Pending Inbound</span>
              <span className="text-lg font-semibold text-slate-900 block mt-0.5">{resaleStats.pendingRequests}</span>
              <span className="text-[10px] text-amber-600 block mt-0.5">Requires decision</span>
            </Link>

            <Link
              href="/supplier/partnerships"
              className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:bg-slate-100/70 transition-colors block"
            >
              <span className="text-[11px] font-medium text-slate-500 block">Authorized Sellers</span>
              <span className="text-lg font-semibold text-teal-700 block mt-0.5">{resaleStats.activePartnerships}</span>
            </Link>
          </div>
        </div>

        {/* Catalog Moderation & Ownership Model */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-indigo-600" />
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Catalog & Source Product Identity
              </h2>
            </div>
            <Link
              href="/supplier"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-0.5"
            >
              <span>Catalog</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 block">Awaiting Moderation</span>
              <span className="text-lg font-semibold text-slate-900 block mt-0.5">{modStats.pendingApproval}</span>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 block">Source Products</span>
              <span className="text-lg font-semibold text-slate-900 block mt-0.5">{data?.totalProducts ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Restock Radar Table ── */}
      {data && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Restock Radar</h2>
            </div>
            <Link
              href="/supplier/inventory"
              className="text-xs text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-0.5"
            >
              <span>Manage inventory</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {data.restockSuggestions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-normal">
              No urgent restock items detected. All products have healthy inventory buffers.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 font-medium">Product / SKU</th>
                    <th className="py-2.5 px-3 font-medium w-24 text-right">In Stock</th>
                    <th className="py-2.5 px-3 font-medium w-28 text-right">30d Sold</th>
                    <th className="py-2.5 px-3 font-medium w-28 text-right">Est. Cover</th>
                    <th className="py-2.5 px-3 font-medium w-24 text-center">Urgency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.restockSuggestions.map((item) => (
                    <tr key={item.productId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900 truncate max-w-sm">{item.productName}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{item.productId}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-800">{item.stockQuantity}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{item.soldLast30Days}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {item.daysOfCover >= 999 ? "N/A" : `${item.daysOfCover}d`}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <UrgencyBadge urgency={item.urgency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Quick Action Shortcuts ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/supplier"
          className="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors shadow-xs group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:text-slate-900">
            <Package size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">Manage Catalog</div>
            <div className="text-[11px] text-slate-500">Edit source products</div>
          </div>
        </Link>

        <Link
          href="/supplier/resale-requests"
          className="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors shadow-xs group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 group-hover:text-teal-700">
            <Inbox size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">Resale Requests</div>
            <div className="text-[11px] text-slate-500">Review proposals</div>
          </div>
        </Link>

        <Link
          href="/supplier/bulk-upload"
          className="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors shadow-xs group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:text-slate-900">
            <UploadCloud size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">CSV Bulk Upload</div>
            <div className="text-[11px] text-slate-500">Batch import SKUs</div>
          </div>
        </Link>

        <Link
          href="/supplier/inventory"
          className="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors shadow-xs group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:text-slate-900">
            <Layers size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">Stock Levels</div>
            <div className="text-[11px] text-slate-500">Adjust wholesale units</div>
          </div>
        </Link>
      </div>
      <RoleAssistantLauncher role="supplier" />
    </div>
  );
}
