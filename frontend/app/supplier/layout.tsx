"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CSSProperties, useEffect, useState } from "react";
import { getUser, logout, logoutServerSession, subscribeToAuthChanges } from "@/lib/auth";

const NAV_ITEMS = [
  { name: "Catalog Management", path: "/supplier", icon: "📋", exact: true },
  { name: "Dashboard", path: "/supplier/dashboard", icon: "📊" },
  { name: "Inventory", path: "/supplier/inventory", icon: "🗄️" },
  { name: "CSV Bulk Upload", path: "/supplier/bulk-upload", icon: "📤" },
  { name: "Finance", path: "/supplier/finance", icon: "💰" },
  { name: "Reviews", path: "/supplier/reviews", icon: "⭐" },
];

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const sync = () => {
      const user = getUser();
      if (user) {
        setUserEmail(user.email || "");
        setUserName(
          user.firstName
            ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
            : user.username || user.email || "Supplier"
        );
      }
    };
    sync();
    return subscribeToAuthChanges(sync);
  }, []);

  const handleLogout = async () => {
    logout();
    await logoutServerSession();
    router.replace("/login");
  };

  const isActive = (item: (typeof NAV_ITEMS)[0]) => {
    if (item.exact) return pathname === item.path;
    return pathname === item.path || pathname.startsWith(item.path + "/");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside style={sidebarStyle}>
        {/* Brand */}
        <div style={brandStyle}>
          <div style={brandIconStyle}>🏭</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc" }}>Supplier Portal</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Supply Hub</div>
          </div>
        </div>

        <div style={dividerStyle} />

        {/* Nav */}
        <nav style={{ padding: "0 12px", flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0 6px", marginBottom: 8 }}>
            Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                href={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  color: active ? "#f8fafc" : "#94a3b8",
                  background: active ? "rgba(20,184,166,0.22)" : "transparent",
                  textDecoration: "none",
                  fontWeight: active ? 600 : 400,
                  fontSize: 14,
                  transition: "all 0.15s ease",
                  marginBottom: 2,
                  borderLeft: active ? "3px solid #2dd4bf" : "3px solid transparent"}}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div style={dividerStyle} />

        {/* User info + Logout */}
        <div style={{ padding: "0 12px 16px" }}>
          <div style={userCardStyle}>
            <div style={avatarStyle}>{(userName[0] || "S").toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userName}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userEmail}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            style={logoutButtonStyle}
          >
            <span>🚪</span> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: "auto", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}

const sidebarStyle: CSSProperties = {
  width: 240,
  background: "#0f172a",
  display: "flex",
  flexDirection: "column",
  padding: "20px 0 0",
  position: "sticky",
  top: 0,
  height: "100vh",
  flexShrink: 0};

const brandStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0 20px 20px"};

const brandIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  background: "linear-gradient(135deg, #14b8a6, #06b6d4)",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  flexShrink: 0};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.06)",
  margin: "0 12px 16px"};

const userCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 10,
  marginBottom: 8};

const avatarStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #14b8a6, #06b6d4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 700,
  color: "#fff",
  flexShrink: 0};

const logoutButtonStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 12px",
  background: "transparent",
  border: "1px solid rgba(239,68,68,0.25)",
  borderRadius: 10,
  color: "#f87171",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s ease"};
