"use client";

import "./shipper.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getUser, logoutServerSession, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
import {
  LayoutDashboard,
  Truck,
  MapPin,
  AlertTriangle,
  MessageSquare,
  LogOut,
  Menu,
  X,
} from "lucide-react";

type ShipperNavItem = {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  href: string;
  highlight?: boolean;
};

const NAV_ITEMS: ShipperNavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/shipper/dashboard" },
  { label: "My Orders", icon: Truck, href: "/shipper/orders" },
  { label: "Live Tracking", icon: MapPin, href: "/shipper/tracking" },
  { label: "Issues & Incidents", icon: AlertTriangle, href: "/shipper/issues" },
  {
    label: "Dispatch Inbox",
    icon: MessageSquare,
    href: "/staff/support-chat",
    highlight: true,
  },
];

export default function ShipperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(getUser());
  const [mobileOpen, setMobileOpen] = useState(false);

  const syncUser = useCallback(() => {
    const u = getUser();
    if (!u) { setUser(null); router.replace("/login?returnTo=/shipper/dashboard"); }
    else if (u.role !== "shipper") {
      setUser(null);
      const home = u.role === "admin" ? "/admin" : u.role === "seller" ? "/seller/dashboard" : u.role === "supplier" ? "/supplier/dashboard" : u.role === "employee" ? "/staff" : "/";
      router.replace(home);
    } else setUser(u);
  }, [router]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(syncUser);
    void refreshCurrentUserFromServer().then(syncUser);
    return unsubscribe;
  }, [syncUser]);

  const handleLogout = async () => {
    await logoutServerSession();
    router.replace("/login");
  };

  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
      user.email?.[0]?.toUpperCase() ||
      "S"
    : "S";

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "Shipper";

  if (!user) return <div className="sh-auth-loading">Loading delivery workspace…</div>;

  return (
    <div className="sh-root">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sh-backdrop fixed inset-0 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sh-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sh-sidebar-header">
          <div className="sh-sidebar-logo">
            <div className="sh-sidebar-logo-icon">
              <Truck size={18} strokeWidth={1.75} className="text-white" />
            </div>
            <div className="sh-sidebar-logo-text">
              <strong>Shipper</strong>
            </div>
          </div>
          <button
            type="button"
            className="sh-mobile-close lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sh-sidebar-nav">
          <span className="sh-nav-section-label">Operations</span>
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/shipper/dashboard"
                ? pathname === "/shipper/dashboard" || pathname === "/shipper"
                : item.href === "/staff/support-chat"
                  ? pathname.startsWith("/staff/support-chat")
                  : pathname.startsWith(item.href);
            const extra = item.highlight ? " sh-nav-link--inbox" : "";
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sh-nav-link${extra}${active ? " active" : ""}`}
              >
                <span className="sh-nav-link-icon">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sh-sidebar-footer">
          <div className="sh-sidebar-user">
            <div className="sh-sidebar-avatar">{initials}</div>
            <div className="sh-sidebar-user-info">
              <div className="sh-sidebar-user-name">{displayName}</div>
              <div className="sh-sidebar-user-role">Fulfillment Agent</div>
            </div>
          </div>
          <button
            type="button"
            className="sh-btn-logout"
            onClick={() => void handleLogout()}
          >
            <LogOut size={14} strokeWidth={1.75} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="sh-content-wrap">
        <div className="sh-mobile-header lg:hidden">
          <button
            type="button"
            className="sh-hamburger-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <span className="sh-mobile-title">Shipper Portal</span>
          <div style={{ width: 20 }} />
        </div>
        <main className="sh-main">{children}</main>
      </div>
    </div>
  );
}
