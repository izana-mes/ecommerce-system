"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CSSProperties, useEffect, useState } from "react";
import { getUser, isAuthenticated, subscribeToAuthChanges } from "@/lib/auth";

const STAFF_NAV = [
  { name: "Dashboard", path: "/staff" },
  { name: "Orders", path: "/staff/orders" },
  { name: "Shippers", path: "/staff/shippers" },
  { name: "Issues", path: "/staff/issues" },
  { name: "SLA Monitoring", path: "/staff/sla" },
];

/** Shippers may open /staff/support-chat for inbox only — hide other staff tools. */
const SHIPPER_STAFF_NAV = [
  { name: "Delivery hub", path: "/shipper/dashboard" },
  { name: "Inbox", path: "/staff/support-chat" },
];

function isStaffAreaRole(role: string | undefined): boolean {
  return role === "admin" || role === "employee" || role === "shipper";
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const auth = isAuthenticated();
      const user = getUser();
      if (!auth || !isStaffAreaRole(user?.role)) {
        router.push("/login?redirect=/staff");
        return;
      }
      setIsAuthLoading(false);
    };

    checkAuth();
    return subscribeToAuthChanges(checkAuth);
  }, [router]);

  if (isAuthLoading) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  const user = getUser();
  const isShipper = user?.role === "shipper";
  const navItems = isShipper ? SHIPPER_STAFF_NAV : STAFF_NAV;
  const portalTitle = isShipper ? "Shipper" : "Staff Portal";
  const portalSubtitle = isShipper ? "Messages" : null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f6f7fb" }}>
      <aside style={{ width: 250, background: "#101828", color: "#fff", padding: "24px 0", flexShrink: 0 }}>
        <div style={{ padding: "0 24px", marginBottom: 32 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{portalTitle}</h2>
          {portalSubtitle ? (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9ca3af" }}>{portalSubtitle}</p>
          ) : null}
        </div>
        <nav style={{ display: "grid", gap: 4, padding: "0 12px" }}>
          {navItems.map((item) => {
            const active =
              item.path === "/staff"
                ? pathname === "/staff"
                : item.path === "/shipper/dashboard"
                  ? pathname === "/shipper/dashboard" || pathname === "/shipper"
                  : pathname.startsWith(item.path);
            const style: CSSProperties = {
              display: "block",
              padding: "10px 14px",
              borderRadius: 8,
              color: active ? "#fff" : "#9ca3af",
              background: active ? "rgba(255,255,255,0.1)" : "transparent",
              textDecoration: "none",
              fontWeight: 500,
              fontSize: 14,
              transition: "all 0.2s"};
            return (
              <Link key={item.path} href={item.path} style={style}>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="jp-seigaiha-bg" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {children}
      </main>
    </div>
  );
}
