"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser, logoutServerSession, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Layers,
  Search,
  FileText,
  Handshake,
  Tag,
  CreditCard,
  Star,
  LogOut,
  Menu,
  X,
  Store,
  Bell,
  UserRound,
} from "lucide-react";
import "../management-shell.css";

interface NavGroup {
  title: string;
  items: {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
    exact?: boolean;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Catalog & Orders",
    items: [
      { name: "Dashboard", path: "/seller/dashboard", icon: LayoutDashboard },
      { name: "My Products", path: "/seller", icon: Package, exact: true },
      { name: "Inventory", path: "/seller/inventory", icon: Layers },
      { name: "Orders", path: "/seller/orders", icon: ShoppingCart },
    ],
  },
  {
    title: "Resale & Partnerships",
    items: [
      { name: "Find Supplier Products", path: "/seller/supplier-catalog", icon: Search },
      { name: "My Resale Requests", path: "/seller/resale-requests", icon: FileText },
      { name: "Active Partnerships", path: "/seller/partnerships", icon: Handshake },
      { name: "My Store Listings", path: "/seller/listings", icon: Store },
    ],
  },
  {
    title: "Operations",
    items: [
      { name: "Promotions", path: "/seller/promotions", icon: Tag },
      { name: "Finance", path: "/seller/finance", icon: CreditCard },
      { name: "Reviews", path: "/seller/reviews", icon: Star },
    ],
  },
  { title: "Account", items: [ { name: "Notifications", path: "/notifications", icon: Bell }, { name: "Profile & Settings", path: "/profile", icon: UserRound } ] },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const sync = () => {
      setAuthorized(false);
      const user = getUser();
      if (!user) { router.replace("/login?returnTo=/seller/dashboard"); return; }
      if (user.role !== "seller") {
        const home = user.role === "admin" ? "/admin" : user.role === "supplier" ? "/supplier/dashboard" : user.role === "shipper" ? "/shipper/dashboard" : user.role === "employee" ? "/staff" : "/";
        router.replace(home); return;
      }
      setAuthorized(true);
      if (user) {
        setUserEmail(user.email || "");
        setUserName(
          user.firstName
            ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
            : user.username || user.email || "Seller"
        );
      }
    };
    const unsubscribe = subscribeToAuthChanges(sync);
    void refreshCurrentUserFromServer().then(sync);
    return unsubscribe;
  }, [router]);

  const handleLogout = async () => {
    await logoutServerSession();
    router.replace("/login");
  };

  const isItemActive = (path: string, exact?: boolean) => {
    if (exact) return pathname === path;
    return pathname === path || pathname.startsWith(path + "/");
  };

  if (!authorized) return <div className="management-loading">Loading seller workspace…</div>;

  return (
    <div className="management-frame flex min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(23, 23, 23, 0.28)" }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 border-r border-slate-800 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-400/20 text-indigo-400">
              <Store size={18} strokeWidth={1.75} />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-white block">Seller</span>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-3 mb-1.5 text-[11px] font-medium tracking-wider uppercase text-slate-400">
                {group.title}
              </div>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isItemActive(item.path, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-colors ${
                        active
                          ? "bg-indigo-600/15 text-indigo-300 font-medium border border-indigo-500/20 shadow-xs"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.75}
                        className={active ? "text-indigo-400" : "text-slate-400"}
                      />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700">
              {(userName[0] || "S").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{userName}</p>
              <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20 cursor-pointer"
          >
            <LogOut size={14} strokeWidth={1.75} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200 sticky top-0 z-30">
          <button
            type="button"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-slate-900">Seller</span>
          <div className="w-8" />
        </div>

        <main className="flex-1 min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
