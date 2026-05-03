"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CSSProperties, useEffect, useState } from "react";
import { getUser, isAuthenticated, subscribeToAuthChanges } from "@/lib/auth";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const auth = isAuthenticated();
      const user = getUser();
      if (!auth || (user?.role !== "admin" && user?.role !== "employee")) {
        router.push("/login?redirect=/staff");
      } else {
        setIsAuthLoading(false);
      }
    };
    
    checkAuth();
    return subscribeToAuthChanges(checkAuth);
  }, [router]);

  if (isAuthLoading) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  const navItems = [
    { name: "Dashboard", path: "/staff" },
    { name: "Orders", path: "/staff/orders" },
    { name: "Shippers", path: "/staff/shippers" },
    { name: "Issues", path: "/staff/issues" },
    { name: "SLA Monitoring", path: "/staff/sla" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f6f7fb" }}>
      <aside style={{ width: 250, background: "#101828", color: "#fff", padding: "24px 0", flexShrink: 0 }}>
        <div style={{ padding: "0 24px", marginBottom: 32 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Staff Portal</h2>
        </div>
        <nav style={{ display: "grid", gap: 4, padding: "0 12px" }}>
          {navItems.map((item) => {
            const active = item.path === "/staff" ? pathname === "/staff" : pathname.startsWith(item.path);
            const style: CSSProperties = {
              display: "block",
              padding: "10px 14px",
              borderRadius: 8,
              color: active ? "#fff" : "#9ca3af",
              background: active ? "rgba(255,255,255,0.1)" : "transparent",
              textDecoration: "none",
              fontWeight: 500,
              fontSize: 14,
              transition: "all 0.2s",
            };
            return (
              <Link key={item.path} href={item.path} style={style}>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {children}
      </main>
    </div>
  );
}
