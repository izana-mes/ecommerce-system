"use client";

import "./shipper.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getUser, logout, logoutServerSession, subscribeToAuthChanges } from "@/lib/auth";
import {
  MdDashboard,
  MdLocationOn,
  MdWarning,
  MdLocalShipping,
  MdLogout,
  MdPerson,
  MdMail} from "react-icons/md";

type ShipperNavItem = {
  label: string;
  icon: React.ReactNode;
  href: string;
  /** Visually emphasize (e.g. inbox for customer/admin messages). */
  highlight?: boolean;
};

const NAV_ITEMS: ShipperNavItem[] = [
  { label: "Overview", icon: <MdDashboard />, href: "/shipper/dashboard" },
  {
    label: "Inbox",
    icon: <MdMail />,
    href: "/staff/support-chat",
    highlight: true},
  { label: "My Orders", icon: <MdLocalShipping />, href: "/shipper/orders" },
  { label: "Live Tracking", icon: <MdLocationOn />, href: "/shipper/tracking" },
  { label: "Issues & Help", icon: <MdWarning />, href: "/shipper/issues" },
];

export default function ShipperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(getUser());

  const syncUser = useCallback(() => {
    const u = getUser();
    setUser(u);
    if (!u) router.replace("/login?returnTo=/shipper/dashboard");
    else if (u.role !== "shipper" && u.role !== "admin")
      router.replace("/profile");
  }, [router]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(syncUser);
    queueMicrotask(syncUser);
    return unsubscribe;
  }, [syncUser]);

  const handleLogout = async () => {
    logout();
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

  return (
    <div className="sh-root">
      {/* ── Sidebar ── */}
      <aside className="sh-sidebar">
        <div className="sh-sidebar-header">
          <div className="sh-sidebar-logo">
            <div className="sh-sidebar-logo-icon">🚚</div>
            <div className="sh-sidebar-logo-text">
              <strong>ShipperHub</strong>
              <span>Delivery Portal</span>
            </div>
          </div>
        </div>

        <nav className="sh-sidebar-nav">
          <span className="sh-nav-section-label">Navigation</span>
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/shipper/dashboard"
                ? pathname === "/shipper/dashboard" || pathname === "/shipper"
                : item.href === "/staff/support-chat"
                  ? pathname.startsWith("/staff/support-chat")
                  : pathname.startsWith(item.href);
            const extra = item.highlight ? " sh-nav-link--inbox" : "";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sh-nav-link${extra}${active ? " active" : ""}`}
              >
                <span className="sh-nav-link-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sh-sidebar-footer">
          <div className="sh-sidebar-user">
            <div className="sh-sidebar-avatar">{initials}</div>
            <div className="sh-sidebar-user-info">
              <div className="sh-sidebar-user-name">{displayName}</div>
              <div className="sh-sidebar-user-role">Shipper</div>
            </div>
            <MdPerson style={{ color: "#475569", fontSize: 18 }} />
          </div>
          <button className="sh-btn-logout" onClick={() => void handleLogout()}>
            <MdLogout /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="sh-main">{children}</main>
    </div>
  );
}
