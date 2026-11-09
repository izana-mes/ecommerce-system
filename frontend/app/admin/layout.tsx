"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Bell, Boxes, FileCheck2, Handshake, LayoutDashboard, LogOut, Menu, Package, Settings, Shield, X } from "lucide-react";
import { getUser, logoutServerSession, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
import "./admin-shell.css";

const links = [
  ["Overview", "/admin", LayoutDashboard], ["Product requests", "/admin/supplier-products", FileCheck2],
  ["Partnerships", "/admin/partnerships", Handshake], ["Coupons", "/admin/coupons", Package],
  ["Fraud review", "/admin/fraud", Shield], ["Shifts", "/admin/shifts", Activity],
  ["Notifications", "/notifications", Bell], ["Profile & settings", "/profile", Settings],
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Administrator");

  useEffect(() => {
    const check = () => {
      setReady(false);
      const user = getUser();
      if (!user) { router.replace("/login?returnTo=/admin"); return; }
      if (user.role !== "admin") {
        const home = user.role === "seller" ? "/seller/dashboard" : user.role === "supplier" ? "/supplier/dashboard" : user.role === "shipper" ? "/shipper/dashboard" : user.role === "employee" ? "/staff" : "/";
        router.replace(home); return;
      }
      setName([user.firstName, user.lastName].filter(Boolean).join(" ") || user.email);
      setReady(true);
    };
    const unsubscribe = subscribeToAuthChanges(check);
    void refreshCurrentUserFromServer().then(check);
    return unsubscribe;
  }, [router]);

  if (!ready) return <div className="management-loading">Loading administration…</div>;
  return <div className="admin-shell">
    {open && <button className="admin-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`admin-sidebar${open ? " is-open" : ""}`}>
      <div className="admin-brand"><span className="admin-brand-mark"><Boxes size={17}/></span><span>Commerce</span><button className="admin-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18}/></button></div>
      <nav className="admin-nav" aria-label="Administration navigation">
        {links.map(([label, href, Icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`)) ? "active" : ""}><Icon size={17} strokeWidth={1.8}/>{label}</Link>)}
      </nav>
      <div className="admin-user"><span className="admin-avatar">{name[0]?.toUpperCase() || "A"}</span><span className="admin-user-name">{name}</span><button aria-label="Sign out" onClick={async () => { await logoutServerSession(); router.replace("/login"); }}><LogOut size={16}/></button></div>
    </aside>
    <div className="admin-main"><header className="admin-toolbar"><button className="admin-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><span>Administration</span><span className="admin-toolbar-user">{name}</span></header>{children}</div>
  </div>;
}
