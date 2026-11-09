"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
import { createOrdersStompClient } from "@/lib/ordersSocket";
import toast from "react-hot-toast";
import { Bell, Check, CheckCheck, Circle, ExternalLink, Filter, RefreshCw, ShoppingBag, CreditCard, ShieldCheck, MessageSquare, Tag, AlertCircle } from "lucide-react";

type NotificationItem = {
  id: number;
  userId: string;
  dedupeKey: string;
  category: string;
  title: string;
  message: string;
  targetUrl?: string | null;
  relatedEntityId?: string | null;
  createdAt: string;
  readAt?: string | null;
};

const CATEGORIES = [
  { id: "all", label: "All", icon: Bell },
  { id: "product", label: "Product", icon: ShieldCheck },
  { id: "order", label: "Orders", icon: ShoppingBag },
  { id: "payment", label: "Payments", icon: CreditCard },
  { id: "message", label: "Messages", icon: MessageSquare },
  { id: "coupon", label: "Coupons", icon: Tag },
  { id: "system", label: "System", icon: AlertCircle },
];

const STATUS_FILTERS = [
  { id: "all", label: "All status" },
  { id: "unread", label: "Unread only" },
  { id: "read", label: "Read" },
];

export default function NotificationCenterPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(getUser());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetchNotifications = useCallback(
    async (targetPage = page, showLoader = false) => {
      if (!getUser()) return;
      if (showLoader) setRefreshing(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("size", String(pageSize));
        if (selectedCategory !== "all") {
          params.set("category", selectedCategory);
        }
        if (selectedStatus !== "all") {
          params.set("status", selectedStatus);
        }

        const response = await fetch(`/api/notifications?${params.toString()}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load notifications");
        }

        const data = await response.json();
        const items = Array.isArray(data?.content)
          ? data.content
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setNotifications(items);
        setUnreadCount(Number(data?.unreadCount ?? 0));
        setTotalPages(Number(data?.totalPages ?? 1));
        setTotalElements(Number(data?.totalElements ?? items.length));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load notifications");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, selectedCategory, selectedStatus]
  );

  useEffect(() => {
    const sync = async () => {
      const user = getUser();
      if (!user) {
        const refreshed = await refreshCurrentUserFromServer();
        if (!refreshed) {
          router.replace("/login?returnTo=/notifications");
          return;
        }
        setCurrentUser(refreshed);
      } else {
        setCurrentUser(user);
      }
    };
    void sync();
    return subscribeToAuthChanges(sync);
  }, [router]);

  useEffect(() => {
    void fetchNotifications(page, true);
  }, [fetchNotifications, page, pageSize, selectedCategory, selectedStatus]);

  // Realtime subscription via STOMP WebSocket
  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;

    let client: ReturnType<typeof createOrdersStompClient> | null = null;
    try {
      client = createOrdersStompClient(() => {
        client?.subscribe(`/topic/customer-notifications/${userId}`, () => {
          void fetchNotifications(0, false);
        });
      });
      client.activate();
    } catch {
      // Fallback: safe interval
    }

    const timer = setInterval(() => {
      // WebSocket updates are the primary refresh path. Poll only while the
      // connection is unavailable instead of duplicating every notification read.
      if (!client?.connected) void fetchNotifications(page, false);
    }, 30000);

    return () => {
      clearInterval(timer);
      void client?.deactivate();
    };
  }, [currentUser, fetchNotifications, page]);

  const handleMarkRead = async (item: NotificationItem) => {
    setProcessingId(item.id);
    try {
      const response = await fetch(`/api/notifications/${item.id}/read`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to mark as read");

      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error("Could not mark notification as read");
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkUnread = async (item: NotificationItem) => {
    setProcessingId(item.id);
    try {
      const response = await fetch(`/api/notifications/${item.id}/unread`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to mark as unread");

      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: null } : n))
      );
      setUnreadCount((c) => c + 1);
    } catch {
      toast.error("Could not mark notification as unread");
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to mark all as read");

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Could not mark all notifications as read");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.readAt) {
      await handleMarkRead(item);
    }
    const target = item.targetUrl?.trim();
    if (target) {
      // Validate local relative URL to prevent open redirects
      if (target.startsWith("/") && !target.startsWith("//")) {
        router.push(target);
      }
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = (category || "system").toLowerCase();
    switch (cat) {
      case "product":
        return { label: "Product", bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" };
      case "order":
        return { label: "Order", bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" };
      case "payment":
        return { label: "Payment", bg: "#fefce8", color: "#854d0e", border: "#fef08a" };
      case "message":
        return { label: "Message", bg: "#faf5ff", color: "#6b21a8", border: "#e9d5ff" };
      case "coupon":
        return { label: "Coupon", bg: "#fff7ed", color: "#9a3412", border: "#fed7aa" };
      default:
        return { label: "System", bg: "#f8fafc", color: "#475569", border: "#e2e8f0" };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "60px 16px", maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 12px", color: "#64748b" }} />
        <p style={{ color: "#64748b" }}>Loading your notifications...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "80vh", background: "#f8fafc", padding: "40px 16px 80px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1e293b", color: "#fff", display: "grid", placeItems: "center" }}>
                <Bell size={20} />
              </div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#0f172a" }}>
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span style={{ background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, padding: "2px 10px", borderRadius: 999 }}>
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
              Stay updated on product approvals, orders, payments, and system notices.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void fetchNotifications(page, true)}
              disabled={refreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#475569",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={markingAll}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#0284c7",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <CheckCheck size={16} />
                {markingAll ? "Marking..." : "Mark all as read"}
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ background: "#fff", padding: "16px 20px", borderRadius: 16, border: "1px solid #e2e8f0", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            {/* Category tabs */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setPage(0);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 600,
                      border: isActive ? "1px solid #0f172a" : "1px solid #e2e8f0",
                      background: isActive ? "#0f172a" : "#fff",
                      color: isActive ? "#fff" : "#475569",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Icon size={14} />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Status dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(0);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  fontSize: 13,
                  color: "#0f172a",
                }}
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div style={{ display: "grid", gap: 10 }}>
          {notifications.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "60px 20px", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f1f5f9", display: "grid", placeItems: "center", margin: "0 auto 16px", color: "#94a3b8" }}>
                <Check size={28} />
              </div>
              <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "#1e293b" }}>You are all caught up!</h3>
              <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                {selectedCategory !== "all" || selectedStatus !== "all"
                  ? "No notifications match your current filter selection."
                  : "No notifications right now. Any product updates or orders will appear here."}
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isUnread = !item.readAt;
              const badge = getCategoryBadge(item.category);
              const isProcessing = processingId === item.id;

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    borderRadius: 14,
                    background: isUnread ? "#ffffff" : "#fcfcfd",
                    border: isUnread ? "1px solid #bae6fd" : "1px solid #e2e8f0",
                    boxShadow: isUnread ? "0 2px 8px rgba(2, 132, 199, 0.08)" : "none",
                    position: "relative",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    onClick={() => void handleNotificationClick(item)}
                    style={{ flex: 1, cursor: item.targetUrl ? "pointer" : "default" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      {isUnread && (
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0284c7", display: "inline-block" }} />
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {badge.label}
                      </span>
                      <time style={{ fontSize: 12, color: "#94a3b8" }} dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleString()}
                      </time>
                    </div>

                    <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: isUnread ? 700 : 600, color: "#0f172a" }}>
                      {item.title}
                    </h4>

                    <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
                      {item.message}
                    </p>

                    {item.targetUrl && (
                      <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4, color: "#0284c7", fontSize: 12, fontWeight: 600 }}>
                        <span>Open details</span>
                        <ExternalLink size={12} />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void (isUnread ? handleMarkRead(item) : handleMarkUnread(item))}
                      title={isUnread ? "Mark as read" : "Mark as unread"}
                      aria-label={isUnread ? "Mark as read" : "Mark as unread"}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: isUnread ? "#f8fafc" : "#fff",
                        color: isUnread ? "#0284c7" : "#94a3b8",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                      }}
                    >
                      {isUnread ? <Check size={14} /> : <Circle size={14} />}
                      <span>{isUnread ? "Read" : "Unread"}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              Showing {notifications.length} of {totalElements} notifications
            </span>

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: page <= 0 ? "#f1f5f9" : "#fff",
                  color: page <= 0 ? "#94a3b8" : "#0f172a",
                  cursor: page <= 0 ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Previous
              </button>

              <span style={{ fontSize: 13, color: "#475569", padding: "0 8px" }}>
                Page {page + 1} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: page >= totalPages - 1 ? "#f1f5f9" : "#fff",
                  color: page >= totalPages - 1 ? "#94a3b8" : "#0f172a",
                  cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
