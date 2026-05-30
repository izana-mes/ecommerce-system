"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  LayoutDashboard, ShoppingBag, Users, Truck, BarChart2, Bell,
  Settings, LogOut, Search, ChevronDown, ChevronRight, ArrowUpRight,
  ArrowDownRight, TrendingUp, Package, DollarSign, Star, Clock,
  CheckCircle, AlertCircle, XCircle, RefreshCw, Filter, Download,
  Plus, MoreHorizontal, Eye, Edit, Trash2, Activity, Zap,
  Globe, Shield, UserCheck, FileText, Layers, PieChart, X,
  Menu, Home, ChevronUp
} from "lucide-react";
import "./enterprise.css";

/* ── STATIC MOCK DATA ─────────────────────────── */
const KPI_CARDS = [
  { label: "Total Revenue",     value: "$248,300",  delta: "+12.4%", up: true,  icon: DollarSign,  color: "#1a56db" },
  { label: "Total Orders",      value: "3,842",     delta: "+8.1%",  up: true,  icon: ShoppingBag, color: "#059669" },
  { label: "Active Suppliers",  value: "186",       delta: "+2.3%",  up: true,  icon: Truck,       color: "#d97706" },
  { label: "Team Members",      value: "94",        delta: "-1.2%",  up: false, icon: Users,       color: "#7c3aed" },
] as const;

const PRODUCTS = [
  { id: "PRD-001", name: "Premium Cotton Shirt",  category: "Apparel",     stock: 248, price: "$49.99", status: "active",   sales: 1204 },
  { id: "PRD-002", name: "Wool Blend Jacket",     category: "Outerwear",   stock: 83,  price: "$129.00",status: "active",   sales: 876 },
  { id: "PRD-003", name: "Linen Summer Dress",    category: "Women",       stock: 0,   price: "$69.50", status: "inactive", sales: 452 },
  { id: "PRD-004", name: "Athletic Running Shoe", category: "Footwear",    stock: 512, price: "$89.99", status: "active",   sales: 2341 },
  { id: "PRD-005", name: "Canvas Backpack",        category: "Accessories", stock: 34,  price: "$44.99", status: "low",      sales: 683 },
];

const SUPPLIERS = [
  { id: "SUP-01", name: "Osaka Textile Co.",       country: "🇯🇵 Japan",   rating: 4.9, orders: 482, status: "verified"   },
  { id: "SUP-02", name: "Seoul Mode Group",         country: "🇰🇷 Korea",   rating: 4.7, orders: 310, status: "verified"   },
  { id: "SUP-03", name: "Shanghai Fabric House",   country: "🇨🇳 China",   rating: 4.5, orders: 267, status: "pending"    },
  { id: "SUP-04", name: "Berlin Fashion Works",    country: "🇩🇪 Germany", rating: 4.8, orders: 194, status: "verified"   },
  { id: "SUP-05", name: "Hanoi Garment Factory",   country: "🇻🇳 Vietnam", rating: 4.3, orders: 128, status: "review"     },
];

const EMPLOYEES = [
  { id: "EMP-001", name: "Aoi Nakamura",     role: "Senior Designer",    dept: "Creative",   status: "active",   avatar: "AN" },
  { id: "EMP-002", name: "Kenji Watanabe",   role: "Backend Engineer",   dept: "Engineering",status: "active",   avatar: "KW" },
  { id: "EMP-003", name: "Yuki Tanaka",      role: "Product Manager",    dept: "Product",    status: "active",   avatar: "YT" },
  { id: "EMP-004", name: "Hana Yoshida",     role: "UX Researcher",      dept: "Design",     status: "away",     avatar: "HY" },
  { id: "EMP-005", name: "Riku Sato",        role: "Data Analyst",       dept: "Analytics",  status: "inactive", avatar: "RS" },
];

const TIMELINE = [
  { time: "10:42 AM", icon: CheckCircle, color: "#059669", text: "Order #ORD-9823 shipped to Osaka",       bg: "#ecfdf5" },
  { time: "09:18 AM", icon: Package,     color: "#1a56db", text: "New inventory batch received (PRD-004)",  bg: "#eff6ff" },
  { time: "08:55 AM", icon: Users,       color: "#7c3aed", text: "3 new supplier contracts signed",          bg: "#f5f3ff" },
  { time: "08:30 AM", icon: AlertCircle, color: "#d97706", text: "Low stock alert: Canvas Backpack (34 left)",bg: "#fffbeb" },
  { time: "Yesterday",icon: Star,        color: "#ff0211", text: "Monthly KPI target exceeded by +12%",      bg: "#fff0f0" },
];

const NOTIFICATIONS = [
  { type: "order",   icon: ShoppingBag, text: "New order #ORD-9824 from Kyoto",   time: "2m ago",  unread: true },
  { type: "alert",   icon: AlertCircle, text: "Stock critical: Linen Summer Dress", time: "18m ago", unread: true },
  { type: "system",  icon: Shield,      text: "Security audit completed",           time: "1h ago",  unread: true },
  { type: "success", icon: CheckCircle, text: "Payroll processed for June 2026",    time: "3h ago",  unread: false },
  { type: "info",    icon: FileText,    text: "Q2 report generated and ready",      time: "5h ago",  unread: false },
];

const MONTHLY_DATA = [
  { month: "Jan", rev: 68, orders: 42 },
  { month: "Feb", rev: 72, orders: 51 },
  { month: "Mar", rev: 58, orders: 38 },
  { month: "Apr", rev: 85, orders: 64 },
  { month: "May", rev: 91, orders: 72 },
  { month: "Jun", rev: 100, orders: 84 },
];

const SIDEBAR_SECTIONS = [
  {
    label: "OVERVIEW",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",     href: "/enterprise", active: true },
      { icon: Activity,        label: "Analytics",     href: "/enterprise#analytics" },
      { icon: PieChart,        label: "Reports",       href: "/enterprise#reports" },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { icon: ShoppingBag,  label: "Products",  href: "/enterprise#products" },
      { icon: Truck,        label: "Suppliers", href: "/enterprise#suppliers" },
      { icon: Users,        label: "Employees", href: "/enterprise#employees" },
      { icon: Package,      label: "Inventory", href: "/enterprise#inventory" },
      { icon: FileText,     label: "Orders",    href: "/orders" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { icon: Bell,     label: "Notifications", href: "/enterprise#notifications" },
      { icon: Settings, label: "Settings",      href: "/enterprise#settings" },
      { icon: Shield,   label: "Security",      href: "/enterprise#security" },
    ],
  },
];

/* ── HELPERS ───────────────────────────────────── */
function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  const colors = ["#1a56db", "#059669", "#d97706", "#7c3aed", "#ff0211", "#0891b2"];
  const colorIndex = initials.charCodeAt(0) % colors.length;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", background: colors[colorIndex],
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "jp-badge jp-badge-green", inactive: "jp-badge jp-badge-gray",
    pending: "jp-badge jp-badge-yellow", verified: "jp-badge jp-badge-blue",
    review: "jp-badge jp-badge-yellow", away: "jp-badge jp-badge-yellow",
    low: "jp-badge jp-badge-red",
  };
  return <span className={map[status] ?? "jp-badge jp-badge-gray"}>{status}</span>;
}

function BarChart({ data }: { data: typeof MONTHLY_DATA }) {
  const max = Math.max(...data.map((d) => d.rev));
  return (
    <div className="ent-chart-bars">
      {data.map((d, i) => (
        <div key={i} className="ent-chart-col">
          <div className="ent-chart-bar-wrap">
            <motion.div
              className="ent-chart-bar-rev"
              initial={{ height: 0 }}
              animate={{ height: `${(d.rev / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              title={`Revenue: ${d.rev}%`}
            />
            <motion.div
              className="ent-chart-bar-ord"
              initial={{ height: 0 }}
              animate={{ height: `${(d.orders / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.07 + 0.1, ease: [0.22, 1, 0.36, 1] }}
              title={`Orders: ${d.orders}%`}
            />
          </div>
          <span className="ent-chart-label">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function MiniSparkline({ up }: { up: boolean }) {
  const points = up
    ? "0,24 8,20 16,18 24,14 32,16 40,10 48,6 56,8 64,4"
    : "0,4 8,8 16,6 24,10 32,12 40,16 48,14 56,20 64,22";
  return (
    <svg width={64} height={28} viewBox="0 0 64 28" fill="none">
      <polyline points={points} stroke={up ? "#059669" : "#dc2626"} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DonutChart({ value, color }: { value: number; color: string }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={80} height={80} viewBox="0 0 80 80">
      <circle cx={40} cy={40} r={r} stroke="var(--surface-3)" strokeWidth={10} fill="none" />
      <motion.circle
        cx={40} cy={40} r={r} stroke={color} strokeWidth={10} fill="none"
        strokeDasharray={circ} strokeDashoffset={circ}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        strokeLinecap="round"
        style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
      />
      <text x={40} y={40} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill="var(--foreground)">{value}%</text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   ENTERPRISE DASHBOARD
═══════════════════════════════════════════════ */
export default function EnterpriseDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSidebar, setMobileSidebar] = useState(false);

  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <div className="ent-root">
      {/* ── SIDEBAR ─────────────────────────────── */}
      <aside className={`ent-sidebar ${sidebarOpen ? "open" : "collapsed"} ${mobileSidebar ? "mobile-open" : ""}`}>
        <div className="ent-sidebar__top">
          <div className="ent-sidebar__brand">
            <div className="ent-sidebar__brand-icon">U</div>
            {sidebarOpen && <span className="ent-sidebar__brand-name">Uomo ERP</span>}
          </div>
          <button
            className="ent-sidebar__toggle"
            onClick={() => setSidebarOpen((p) => !p)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronLeft16 /> : <ChevronRight size={16} />}
          </button>
        </div>

        <nav className="ent-sidebar__nav">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.label} className="ent-sidebar__section">
              {sidebarOpen && <p className="ent-sidebar__section-label">{section.label}</p>}
              {section.items.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`sidebar-item ${item.active ? "active" : ""}`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <item.icon size={17} strokeWidth={1.8} />
                  {sidebarOpen && <span>{item.label}</span>}
                  {sidebarOpen && item.active && <span className="sidebar-dot" style={{ marginLeft: "auto" }} />}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="ent-sidebar__bottom">
          <div className="sidebar-item" style={{ cursor: "default" }}>
            <Avatar initials="AD" size={24} />
            {sidebarOpen && (
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--sidebar-active)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Admin User</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--sidebar-text)" }}>admin@uomo.jp</p>
              </div>
            )}
          </div>
          <Link href="/" className="sidebar-item" style={{ color: "#f87171" }}>
            <LogOut size={17} strokeWidth={1.8} />
            {sidebarOpen && <span>Sign out</span>}
          </Link>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileSidebar && (
        <button className="ent-mobile-backdrop" onClick={() => setMobileSidebar(false)} aria-label="Close sidebar" />
      )}

      {/* ── MAIN ────────────────────────────────── */}
      <div className="ent-main">
        {/* TOP NAVBAR */}
        <header className="ent-topbar">
          <div className="ent-topbar__left">
            <button
              className="ent-topbar__mobile-menu"
              onClick={() => setMobileSidebar((p) => !p)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="ent-topbar__search">
              <Search size={15} className="ent-topbar__search-icon" />
              <input
                type="text"
                placeholder="Search anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ent-topbar__search-input"
              />
            </div>
          </div>
          <div className="ent-topbar__right">
            <button className="jp-btn jp-btn-secondary ent-topbar__btn">
              <Download size={14} /> Export
            </button>
            <button className="jp-btn jp-btn-primary ent-topbar__btn">
              <Plus size={14} /> New Order
            </button>
            {/* Notification bell */}
            <div style={{ position: "relative" }}>
              <button
                className="ent-topbar__icon-btn"
                onClick={() => setNotifOpen((p) => !p)}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="ent-topbar__notif-dot">{unreadCount}</span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    className="ent-notif-panel"
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className="ent-notif-panel__header">
                      <span>Notifications</span>
                      <button onClick={() => setNotifOpen(false)}><X size={14} /></button>
                    </div>
                    {NOTIFICATIONS.map((n, i) => (
                      <div key={i} className={`ent-notif-item ${n.unread ? "unread" : ""}`}>
                        <div className="ent-notif-item__icon">
                          <n.icon size={14} />
                        </div>
                        <div className="ent-notif-item__body">
                          <p className="ent-notif-item__text">{n.text}</p>
                          <span className="ent-notif-item__time">{n.time}</span>
                        </div>
                        {n.unread && <div className="ent-notif-item__dot" />}
                      </div>
                    ))}
                    <Link href="/enterprise#notifications" className="ent-notif-panel__footer">
                      View all notifications <ChevronRight size={13} />
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Avatar initials="AD" size={32} />
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="ent-content">

          {/* PAGE HEADER */}
          <div className="ent-page-header">
            <div>
              <h1 className="ent-page-title">Enterprise Dashboard</h1>
              <p className="ent-page-sub">Uomo Group · Fiscal Year 2026 · Real-time Overview</p>
            </div>
            <div className="ent-page-header__right">
              <button className="jp-btn jp-btn-secondary">
                <RefreshCw size={14} /> Refresh
              </button>
              <span className="ent-live-badge">
                <span className="ent-live-dot" /> LIVE
              </span>
            </div>
          </div>

          {/* ── KPI CARDS ─────────────────────────── */}
          <section className="ent-section" id="kpi">
            <div className="ent-kpi-grid">
              {KPI_CARDS.map((card, i) => (
                <motion.div
                  key={card.label}
                  className="ent-kpi-card jp-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                >
                  <div className="ent-kpi-card__top">
                    <div className="ent-kpi-card__icon" style={{ background: card.color + "14" }}>
                      <card.icon size={18} color={card.color} strokeWidth={1.8} />
                    </div>
                    <MiniSparkline up={card.up} />
                  </div>
                  <div className="jp-stat-val">{card.value}</div>
                  <div className="ent-kpi-card__bottom">
                    <span className="jp-stat-lbl">{card.label}</span>
                    <span className={`jp-stat-delta ${card.up ? "jp-stat-up" : "jp-stat-down"}`}>
                      {card.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {card.delta}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── CHARTS + DONUT ROW ────────────────── */}
          <section className="ent-section ent-charts-row" id="analytics">
            {/* Bar Chart */}
            <div className="jp-card ent-chart-card">
              <div className="ent-card-header">
                <div>
                  <h2 className="ent-card-title">Revenue & Orders</h2>
                  <p className="ent-card-sub">Monthly trend — Jan to Jun 2026</p>
                </div>
                <div className="ent-chart-legend">
                  <span className="ent-legend-dot" style={{ background: "#1a56db" }} /> Revenue
                  <span className="ent-legend-dot" style={{ background: "#e2e8f0" }} /> Orders
                </div>
              </div>
              <BarChart data={MONTHLY_DATA} />
            </div>

            {/* Donut cards */}
            <div className="ent-donut-col">
              {[
                { label: "Fulfillment Rate",   value: 94, color: "#059669" },
                { label: "Customer Retention", value: 78, color: "#1a56db" },
                { label: "Supplier SLA",       value: 88, color: "#d97706" },
              ].map((d) => (
                <div key={d.label} className="jp-card ent-donut-card">
                  <DonutChart value={d.value} color={d.color} />
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{d.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--foreground-3)" }}>Target: 100%</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── DATA TABLES TABS ──────────────────── */}
          <section className="ent-section" id="products">
            <div className="jp-card">
              <div className="ent-card-header" style={{ paddingBottom: 0 }}>
                <div>
                  <h2 className="ent-card-title">Data Management</h2>
                  <p className="ent-card-sub">Products · Suppliers · Employees</p>
                </div>
                <div className="ent-card-actions">
                  <button className="jp-btn jp-btn-secondary"><Filter size={13} /> Filter</button>
                  <button className="jp-btn jp-btn-primary"><Plus size={13} /> Add New</button>
                </div>
              </div>

              {/* Tab bar */}
              <div className="ent-tabs">
                {["products", "suppliers", "employees"].map((tab) => (
                  <button
                    key={tab}
                    className={`ent-tab ${activeTab === tab ? "active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* PRODUCTS TABLE */}
                  {activeTab === "products" && (
                    <div className="ent-table-wrap">
                      <table className="jp-table">
                        <thead>
                          <tr>
                            <th>Product</th><th>Category</th><th>Price</th>
                            <th>Stock</th><th>Sales</th><th>Status</th><th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PRODUCTS.filter(p =>
                            !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
                          ).map((p) => (
                            <tr key={p.id}>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>{p.name}</span>
                                  <span style={{ fontSize: 11, color: "var(--foreground-muted)" }}>{p.id}</span>
                                </div>
                              </td>
                              <td>{p.category}</td>
                              <td style={{ fontWeight: 600 }}>{p.price}</td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  <span style={{ fontSize: 13 }}>{p.stock}</span>
                                  <div className="jp-bar-track" style={{ width: 60 }}>
                                    <div className="jp-bar-fill" style={{ width: `${Math.min((p.stock / 600) * 100, 100)}%`, background: p.stock === 0 ? "var(--danger)" : p.stock < 50 ? "var(--warning)" : "var(--success)" }} />
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontWeight: 600, color: "var(--brand)" }}>{p.sales.toLocaleString()}</td>
                              <td><StatusBadge status={p.status} /></td>
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button className="jp-btn jp-btn-ghost" style={{ padding: "4px 6px" }}><Eye size={13} /></button>
                                  <button className="jp-btn jp-btn-ghost" style={{ padding: "4px 6px" }}><Edit size={13} /></button>
                                  <button className="jp-btn jp-btn-danger" style={{ padding: "4px 6px" }}><Trash2 size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* SUPPLIERS TABLE */}
                  {activeTab === "suppliers" && (
                    <div className="ent-table-wrap" id="suppliers">
                      <table className="jp-table">
                        <thead>
                          <tr>
                            <th>Supplier</th><th>Country</th><th>Rating</th>
                            <th>Orders</th><th>Status</th><th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SUPPLIERS.map((s) => (
                            <tr key={s.id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <Avatar initials={s.name.slice(0, 2)} size={28} />
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>{s.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--foreground-muted)" }}>{s.id}</div>
                                  </div>
                                </div>
                              </td>
                              <td>{s.country}</td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <Star size={13} fill="#f59e0b" color="#f59e0b" />
                                  <span style={{ fontWeight: 600, fontSize: 13 }}>{s.rating}</span>
                                </div>
                              </td>
                              <td style={{ fontWeight: 600 }}>{s.orders}</td>
                              <td><StatusBadge status={s.status} /></td>
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button className="jp-btn jp-btn-ghost" style={{ padding: "4px 6px" }}><Eye size={13} /></button>
                                  <button className="jp-btn jp-btn-ghost" style={{ padding: "4px 6px" }}><Edit size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* EMPLOYEES TABLE */}
                  {activeTab === "employees" && (
                    <div className="ent-table-wrap" id="employees">
                      <table className="jp-table">
                        <thead>
                          <tr>
                            <th>Employee</th><th>Role</th><th>Department</th>
                            <th>Status</th><th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {EMPLOYEES.map((e) => (
                            <tr key={e.id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <Avatar initials={e.avatar} size={30} />
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>{e.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--foreground-muted)" }}>{e.id}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontSize: 13, color: "var(--foreground-2)" }}>{e.role}</td>
                              <td>
                                <span className="jp-badge jp-badge-gray">{e.dept}</span>
                              </td>
                              <td><StatusBadge status={e.status} /></td>
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button className="jp-btn jp-btn-ghost" style={{ padding: "4px 6px" }}><UserCheck size={13} /></button>
                                  <button className="jp-btn jp-btn-ghost" style={{ padding: "4px 6px" }}><Edit size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          {/* ── BOTTOM ROW: TIMELINE + ANALYTICS CARDS ── */}
          <section className="ent-section ent-bottom-row" id="reports">
            {/* Activity Timeline */}
            <div className="jp-card ent-timeline-card">
              <div className="ent-card-header">
                <div>
                  <h2 className="ent-card-title">Activity Timeline</h2>
                  <p className="ent-card-sub">Today's operations log</p>
                </div>
                <button className="jp-btn jp-btn-ghost"><MoreHorizontal size={16} /></button>
              </div>
              <div className="ent-timeline">
                {TIMELINE.map((item, i) => (
                  <motion.div
                    key={i}
                    className="ent-timeline-item"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div className="ent-timeline-icon" style={{ background: item.bg, color: item.color }}>
                        <item.icon size={13} />
                      </div>
                      {i < TIMELINE.length - 1 && <div className="jp-timeline-line" />}
                    </div>
                    <div className="ent-timeline-body">
                      <p className="ent-timeline-text">{item.text}</p>
                      <span className="ent-timeline-time">
                        <Clock size={11} /> {item.time}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right analytics cards */}
            <div className="ent-analytics-col">
              {/* Top categories */}
              <div className="jp-card ent-analytics-card">
                <h2 className="ent-card-title" style={{ marginBottom: 16 }}>Sales by Category</h2>
                {[
                  { label: "Footwear",    pct: 82, color: "#1a56db" },
                  { label: "Apparel",     pct: 67, color: "#059669" },
                  { label: "Outerwear",   pct: 53, color: "#d97706" },
                  { label: "Accessories", pct: 38, color: "#7c3aed" },
                ].map((cat) => (
                  <div key={cat.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "var(--foreground-2)" }}>
                      <span>{cat.label}</span>
                      <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{cat.pct}%</span>
                    </div>
                    <div className="jp-bar-track">
                      <motion.div
                        className="jp-bar-fill"
                        style={{ background: cat.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.pct}%` }}
                        transition={{ duration: 0.9, delay: 0.3 }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Real-time widgets */}
              <div className="jp-card ent-analytics-card" id="notifications">
                <h2 className="ent-card-title" style={{ marginBottom: 14 }}>Live Indicators</h2>
                {[
                  { icon: Zap,    label: "Server load",   val: "23%",  status: "ok",   color: "#059669" },
                  { icon: Globe,  label: "Active sessions",val: "1,284",status: "ok",   color: "#1a56db" },
                  { icon: Activity,label: "Error rate",   val: "0.02%",status: "ok",   color: "#059669" },
                  { icon: Shield, label: "Threats blocked",val: "14",   status: "warn", color: "#d97706" },
                ].map((w) => (
                  <div key={w.label} className="ent-widget-item">
                    <div className="ent-widget-icon" style={{ color: w.color, background: w.color + "14" }}>
                      <w.icon size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--foreground-3)" }}>{w.label}</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{w.val}</p>
                    </div>
                    <span className={`jp-badge ${w.status === "ok" ? "jp-badge-green" : "jp-badge-yellow"}`}>
                      {w.status === "ok" ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                      {w.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="ent-footer">
            <p>Uomo Enterprise ERP · v2.1.0 · © 2026 Uomo Group</p>
            <div className="ent-footer__links">
              <Link href="/about">About</Link>
              <Link href="/contact">Support</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Tiny helper component to avoid importing from lucide twice */
function ChevronLeft16() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
