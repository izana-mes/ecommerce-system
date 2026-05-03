"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CSSProperties } from "react";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Catalog Management", path: "/supplier" },
    { name: "Dashboard", path: "/supplier/dashboard" },
    { name: "Inventory", path: "/supplier/inventory" },
    { name: "Finance", path: "/supplier/finance" },
    { name: "Reviews", path: "/supplier/reviews" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f6f7fb" }}>
      <aside style={{ width: 250, background: "#101828", color: "#fff", padding: "24px 0" }}>
        <div style={{ padding: "0 24px", marginBottom: 32 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Supplier Portal</h2>
        </div>
        <nav style={{ display: "grid", gap: 4, padding: "0 12px" }}>
          {navItems.map((item) => {
            const active = pathname === item.path;
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
      <main style={{ flex: 1, overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
