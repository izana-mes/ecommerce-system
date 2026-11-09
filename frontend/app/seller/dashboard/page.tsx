"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import toast from "react-hot-toast";
import RoleAssistantLauncher from "@/components/management/RoleAssistantLauncher";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Wallet,
  AlertCircle,
  Clock,
  Handshake,
  FileText,
  ArrowUpRight,
  ChevronRight,
  TrendingUp,
  Store,
  Layers,
  Search,
} from "lucide-react";

type RevenuePoint = { day: string; orders: number; revenue: number };
type TopProduct = { productId: string; productName: string; soldQty: number; revenue: number };

type DashboardData = {
  totalRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalProducts: number;
  activeListings?: number;
  pendingListings?: number;
  inactiveListings?: number;
  totalAuthorizedProducts?: number;
  totalAllocatedInventory?: number;
  remainingInventory?: number;
  outOfStockCount?: number;
  pendingRequestsCount?: number;
  lowStockCount: number;
  availableBalance: number;
  pendingBalance: number;
  revenueByDay: RevenuePoint[];
  topSellingProducts: TopProduct[];
};

type ModerationSummary = {
  pending: number;
  changesRequested: number;
  rejected: number;
};

type ResaleSummary = {
  pendingRequests: number;
  activePartnerships: number;
};

function Sparkline({ data }: { data: RevenuePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-xs font-normal">
        No sales activity recorded for this date range
      </div>
    );
  }

  const WIDTH = 760;
  const HEIGHT = 140;
  const PAD = 12;

  const revenues = data.map((d) => Number(d.revenue));
  const maxRev = Math.max(...revenues, 1);
  const minRev = Math.min(...revenues, 0);

  const points = data.map((d, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (WIDTH - PAD * 2);
    const y = PAD + ((maxRev - Number(d.revenue)) / (maxRev - minRev || 1)) * (HEIGHT - PAD * 2);
    return { x, y, day: d.day, revenue: d.revenue, orders: d.orders };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const fillPoints = [
    `${PAD},${HEIGHT - PAD}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${WIDTH - PAD},${HEIGHT - PAD}`,
  ].join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full block min-w-[320px]">
        <defs>
          <linearGradient id="sellerSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill="url(#sellerSparkGrad)" />
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#4f46e5"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#4f46e5" />
        ))}
      </svg>
      <div className="flex justify-between items-center px-2 pt-2 text-[11px] text-slate-400">
        {[data[0], data[Math.floor(data.length / 2)], data[data.length - 1]].filter(Boolean).map((d, i) => (
          <span key={i}>{d.day ? d.day.slice(5) : ""}</span>
        ))}
      </div>
    </div>
  );
}

export default function SellerDashboardPage() {
  const token = getUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [moderation, setModeration] = useState<ModerationSummary>({ pending: 0, changesRequested: 0, rejected: 0 });
  const [resale, setResale] = useState<ResaleSummary>({ pendingRequests: 0, activePartnerships: 0 });
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchDashboard = useCallback(async (daysParam = 30) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/seller/dashboard?days=${daysParam}&lowStockThreshold=5`, {
        headers: {},
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData?.message || "Failed to load dashboard data");
      setData(resData.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch moderation and resale status in parallel
  const fetchAuxiliaryStatus = useCallback(async () => {
    if (!token) return;
    try {
      // 1. Moderation change requests
      const modRes = await fetch("/api/products/change-requests/mine");
      if (modRes.ok) {
        const modData = await modRes.json();
        const items = Array.isArray(modData) ? modData : modData?.data || [];
        const p = items.filter((x: { status?: string }) => x.status === "PENDING").length;
        const cr = items.filter((x: { status?: string }) => x.status === "CHANGES_REQUESTED").length;
        const r = items.filter((x: { status?: string }) => x.status === "REJECTED").length;
        setModeration({ pending: p, changesRequested: cr, rejected: r });
      }

      // 2. Resale requests
      const resaleRes = await fetch("/api/v1/seller/resale/requests");
      if (resaleRes.ok) {
        const resaleData = await resaleRes.json();
        const rItems = Array.isArray(resaleData?.content) ? resaleData.content : (Array.isArray(resaleData?.data) ? resaleData.data : (Array.isArray(resaleData) ? resaleData : []));
        const pReq = rItems.filter((x: { status?: string }) => x.status === "PENDING").length;
        setResale((prev) => ({ ...prev, pendingRequests: pReq }));
      }

      // 3. Active partnerships
      const authRes = await fetch("/api/v1/seller/resale/authorizations");
      if (authRes.ok) {
        const authData = await authRes.json();
        const aItems = Array.isArray(authData?.content) ? authData.content : (Array.isArray(authData?.data) ? authData.data : (Array.isArray(authData) ? authData : []));
        const activeCount = aItems.filter((x: { active?: boolean }) => x.active !== false).length;
        setResale((prev) => ({ ...prev, activePartnerships: activeCount }));
      }
    } catch {
      // Non-blocking auxiliary fetch
    }
  }, [token]);

  useEffect(() => {
    void fetchDashboard(days);
    void fetchAuxiliaryStatus();
  }, [fetchDashboard, fetchAuxiliaryStatus, days]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Seller Dashboard</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDays(d);
                  setLoading(true);
                  void fetchDashboard(d);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  days === d
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <Link
            href="/seller"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <span>Catalog</span>
            <ArrowUpRight size={14} className="text-slate-400" />
          </Link>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      {loading ? (
        <div className="management-kpi-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200/80 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue */}
          <div className="management-kpi bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Revenue ({days}d)</span>
              <DollarSign size={16} strokeWidth={1.75} className="text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight">
              ${data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Orders */}
          <div className="management-kpi bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Total Orders</span>
              <ShoppingCart size={16} strokeWidth={1.75} className="text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight">
              {data.totalOrders}
            </div>
            <div className="text-[11px] mt-1">
              {data.cancelledOrders > 0 ? (
                <span className="text-rose-600 font-medium">
                  {data.cancelledOrders} cancelled ({data.cancelRate}%)
                </span>
              ) : (
                <span className="text-emerald-600 font-medium">0% cancellation rate</span>
              )}
            </div>
          </div>

          {/* Active Products */}
          <div className="management-kpi bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Active Products</span>
              <Package size={16} strokeWidth={1.75} className="text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight">
              {data.totalProducts}
            </div>
            <div className="text-[11px] mt-1">
              {data.lowStockCount > 0 ? (
                <span className="text-amber-600 font-medium">{data.lowStockCount} low stock alerts</span>
              ) : (
                <span className="text-slate-500">Inventory levels healthy</span>
              )}
            </div>
          </div>

          {/* Balance */}
          <div className="management-kpi bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Available Payout</span>
              <Wallet size={16} strokeWidth={1.75} className="text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight">
              ${data.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {data.pendingBalance > 0 ? (
                <span>+${data.pendingBalance.toFixed(2)} pending clearance</span>
              ) : (
                <span>All settlements cleared</span>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {data && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-indigo-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Storefront Listings & Resale Inventory
              </h2>
            </div>
            <Link
              href="/seller/listings"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>Manage Listings</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">Active Listings</div>
              <div className="mt-1 text-lg font-bold text-emerald-700">{data.activeListings ?? 0}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">Pending Listings</div>
              <div className="mt-1 text-lg font-bold text-amber-700">{data.pendingListings ?? 0}</div>
              <div className="text-[10px] text-slate-400">Awaiting setup/approval</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">Inactive Listings</div>
              <div className="mt-1 text-lg font-bold text-slate-700">{data.inactiveListings ?? 0}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">Authorized Products</div>
              <div className="mt-1 text-lg font-bold text-indigo-700">{data.totalAuthorizedProducts ?? 0}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">Total Allocated Units</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{(data.totalAllocatedInventory ?? 0).toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">Sellable Units</div>
              <div className="mt-1 text-lg font-bold text-indigo-600">{(data.remainingInventory ?? 0).toLocaleString()}</div>
            </div>
          </div>
        </section>
      )}

      {/* ── Action & Attention Center ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Product Moderation Status */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-indigo-600" />
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Product Moderation Queue
              </h2>
            </div>
            <Link
              href="/seller"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-0.5"
            >
              <span>Manage</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 block">Pending</span>
              <span className="text-lg font-semibold text-slate-900 block mt-0.5">{moderation.pending}</span>
              <span className="text-[10px] text-amber-600 block mt-0.5">Awaiting admin</span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 block">Changes Needed</span>
              <span className="text-lg font-semibold text-amber-700 block mt-0.5">{moderation.changesRequested}</span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 block">Rejected</span>
              <span className="text-lg font-semibold text-rose-700 block mt-0.5">{moderation.rejected}</span>
            </div>
          </div>
        </div>

        {/* Resale Network & Supplier Partnerships */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Handshake size={16} className="text-emerald-600" />
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Supplier Partnerships & Resale
              </h2>
            </div>
            <Link
              href="/seller/partnerships"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-0.5"
            >
              <span>Partnerships</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Link
              href="/seller/resale-requests"
              className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:bg-slate-100/70 transition-colors block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">Submitted Requests</span>
                <FileText size={14} className="text-slate-400" />
              </div>
              <span className="text-lg font-semibold text-slate-900 block mt-0.5">{resale.pendingRequests}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Pending supplier review</span>
            </Link>

            <Link
              href="/seller/partnerships"
              className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:bg-slate-100/70 transition-colors block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">Active Partnerships</span>
                <Handshake size={14} className="text-emerald-500" />
              </div>
              <span className="text-lg font-semibold text-emerald-700 block mt-0.5">{resale.activePartnerships}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Authorized products</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Revenue Trend Chart ── */}
      {data && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Revenue Performance</h2>
              <p className="text-xs text-slate-500 mt-0.5">Daily gross sales recorded over the last {days} days</p>
            </div>
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
              {days}-day window
            </span>
          </div>
          <Sparkline data={data.revenueByDay} />
        </div>
      )}

      {/* ── Top Selling Products Table ── */}
      {data && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Top Selling Products</h2>
            </div>
            <Link
              href="/seller/orders"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-0.5"
            >
              <span>View all orders</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {data.topSellingProducts.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-normal">
              No sales data recorded in this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 font-medium w-12">#</th>
                    <th className="py-2.5 px-3 font-medium">Product Name</th>
                    <th className="py-2.5 px-3 font-medium w-28 text-right">Units Sold</th>
                    <th className="py-2.5 px-3 font-medium w-32 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topSellingProducts.map((p, i) => (
                    <tr key={p.productId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-400">
                        {i + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900 truncate max-w-md">{p.productName}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{p.productId}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {p.soldQty}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900">
                        ${p.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          href="/seller"
          className="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors shadow-xs group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:text-slate-900">
            <Package size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">My Catalog</div>
            <div className="text-[11px] text-slate-500">Edit products</div>
          </div>
        </Link>

        <Link
          href="/seller/supplier-catalog"
          className="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors shadow-xs group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:text-indigo-700">
            <Search size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">Find Products</div>
            <div className="text-[11px] text-slate-500">Discover resale</div>
          </div>
        </Link>

        <Link
          href="/seller/inventory"
          className="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors shadow-xs group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:text-slate-900">
            <Layers size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">Stock Levels</div>
            <div className="text-[11px] text-slate-500">Update quantity</div>
          </div>
        </Link>

        <Link
          href="/seller/orders"
          className="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors shadow-xs group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:text-slate-900">
            <ShoppingCart size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">Recent Orders</div>
            <div className="text-[11px] text-slate-500">Fulfill shipments</div>
          </div>
        </Link>
      </div>
      <RoleAssistantLauncher role="seller" />
    </div>
  );
}
