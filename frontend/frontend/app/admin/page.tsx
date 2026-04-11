"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";
import "./admin.css";

type AdminUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  active: boolean;
};

type PagedUsers = {
  content?: AdminUser[];
  totalPages?: number;
  number?: number;
};

type Product = {
  productID: string;
  frontImg: string;
  backImg: string;
  productName: string;
  productPrice: number;
  productReviews: string;
  stockQuantity: number;
  active: boolean;
};

type AdminOrder = {
  id: number;
  order_number: string;
  customer_email: string;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_phone?: string | null;
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
  notes?: string | null;
  total_amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  item_count: number;
  created_at: string;
};

type PagedOrders = {
  content?: AdminOrder[];
  totalPages?: number;
  number?: number;
};

type AdminReview = {
  productID: string;
  reviewID: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type PagedReviews = {
  content?: AdminReview[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
};

type InventoryItem = {
  productID: string;
  productName: string;
  stockQuantity: number;
  soldQty?: number;
  active: boolean;
};

type InventoryHealth = {
  totalProducts: number;
  activeProducts: number;
  totalStock: number;
  totalReservedInCarts: number;
  totalAvailableToSell: number;
  lowStockThreshold: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockItems: InventoryItem[];
  outOfStockItems: InventoryItem[];
  noSalesItems: InventoryItem[];
  topSellingItems: InventoryItem[];
};

type DashboardRevenuePoint = {
  day: string;
  orders: number;
  revenue: number;
};

type DashboardOrderStatusPoint = {
  status: string;
  count: number;
};

type DashboardWishlistTrendPoint = {
  day: string;
  adds: number;
};

type DashboardWishlistProductPoint = {
  productID: string;
  productName: string;
  wishlists: number;
};

type DashboardSoldProductPoint = {
  productID: string;
  productName: string;
  soldQty: number;
};

type DashboardRatingDistributionPoint = {
  rating: number;
  count: number;
};

type DashboardRatingProductPoint = {
  productID: string;
  productName: string;
  reviewCount: number;
  averageRating: number;
  lowRatingCount: number;
};

type DashboardRatingAnalysis = {
  totalReviews: number;
  averageRating: number;
  lowRatingCount: number;
  highRatingCount: number;
  distribution: DashboardRatingDistributionPoint[];
  topReviewedProducts: DashboardRatingProductPoint[];
  lowestRatedProducts: DashboardRatingProductPoint[];
};

type DashboardRecentOrder = {
  id: number;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
};

type DashboardSummary = {
  totalUsers: number;
  activeUsers: number;
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  totalWishlistItems: number;
  uniqueWishlistUsers: number;
  averageWishlistSize: number;
  wishlistAddsByDay: DashboardWishlistTrendPoint[];
  topWishlistedProducts: DashboardWishlistProductPoint[];
  topSoldProducts: DashboardSoldProductPoint[];
  ratingAnalysis: DashboardRatingAnalysis;
  revenueByDay: DashboardRevenuePoint[];
  ordersByStatus: DashboardOrderStatusPoint[];
  recentOrders: DashboardRecentOrder[];
};

type AuditEvent = {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  details: Record<string, unknown>;
  created_at: string;
};

type PagedAudit = {
  content?: AuditEvent[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
};

type QueueItem = {
  name: string;
  messages: number;
  messagesReady: number;
  messagesUnacked: number;
  consumers: number;
  state: string;
  isDlq: boolean;
};

type QueueData = {
  queues: QueueItem[];
  dlqQueues: QueueItem[];
  retryQueues: QueueItem[];
  summary: {
    totalQueues: number;
    totalMessages: number;
    totalConsumers: number;
    totalDlqMessages: number;
  };
};

type SystemHealth = {
  timestamp: string;
  responseTimeMs: number;
  database: { status: string; latencyMs: number; error?: string };
  memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number; externalMB: number };
  process: { uptimeSeconds: number; uptimeFormatted: string; nodeVersion: string; platform: string; pid: number };
  environment: { nodeEnv: string; dbClient: string; dbHost: string };
};

type AdminNote = {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

type AdminSetting = {
  id: number;
  setting_key: string;
  setting_value: string;
  description: string;
  updated_at: string;
};

type AdminTab = "overview" | "users" | "orders" | "inventory" | "products" | "comments" | "audit" | "queues" | "export" | "health" | "notes" | "settings";

type RatingBucket = 1 | 2 | 3 | 4 | 5;

type ProductRatingStat = {
  productID: string;
  reviewCount: number;
  averageRating: number;
  lowRatingCount: number;
};

type RatingAnalyticsSummary = {
  totalReviews: number;
  averageRating: number;
  lowRatingCount: number;
  highRatingCount: number;
  distribution: Record<RatingBucket, number>;
  productStats: ProductRatingStat[];
};

const ORDER_STATUS_OPTIONS = ["pending", "processing", "paid", "shipped", "completed", "cancelled"];
const PAYMENT_STATUS_OPTIONS = ["pending", "authorized", "paid", "failed", "refunded"];

const INITIAL_PRODUCT_FORM: Product = {
  productID: "",
  frontImg: "",
  backImg: "",
  productName: "",
  productPrice: 0,
  productReviews: "",
  stockQuantity: 25,
  active: true,
};

const INITIAL_DASHBOARD: DashboardSummary = {
  totalUsers: 0,
  activeUsers: 0,
  totalProducts: 0,
  activeProducts: 0,
  totalOrders: 0,
  totalRevenue: 0,
  pendingOrders: 0,
  lowStockProducts: 0,
  totalWishlistItems: 0,
  uniqueWishlistUsers: 0,
  averageWishlistSize: 0,
  wishlistAddsByDay: [],
  topWishlistedProducts: [],
  topSoldProducts: [],
  ratingAnalysis: {
    totalReviews: 0,
    averageRating: 0,
    lowRatingCount: 0,
    highRatingCount: 0,
    distribution: [],
    topReviewedProducts: [],
    lowestRatedProducts: [],
  },
  revenueByDay: [],
  ordersByStatus: [],
  recentOrders: [],
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatCurrency(value: number, currency = "USD"): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildRatingAnalytics(reviews: AdminReview[]): RatingAnalyticsSummary {
  const distribution: Record<RatingBucket, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const productMap = new Map<string, { count: number; total: number; low: number }>();
  let totalRating = 0;
  let lowRatingCount = 0;
  let highRatingCount = 0;

  for (const review of reviews) {
    const normalizedRating = clamp(Number(review.rating) || 0, 1, 5) as RatingBucket;
    distribution[normalizedRating] += 1;
    totalRating += normalizedRating;

    if (normalizedRating <= 2) {
      lowRatingCount += 1;
    }
    if (normalizedRating >= 4) {
      highRatingCount += 1;
    }

    const key = String(review.productID || "").trim();
    const existing = productMap.get(key) ?? { count: 0, total: 0, low: 0 };
    existing.count += 1;
    existing.total += normalizedRating;
    if (normalizedRating <= 2) {
      existing.low += 1;
    }
    productMap.set(key, existing);
  }

  const productStats: ProductRatingStat[] = Array.from(productMap.entries())
    .map(([productID, value]) => ({
      productID,
      reviewCount: value.count,
      averageRating: value.count > 0 ? value.total / value.count : 0,
      lowRatingCount: value.low,
    }))
    .sort((a, b) => b.reviewCount - a.reviewCount || b.averageRating - a.averageRating);

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;

  return {
    totalReviews,
    averageRating,
    lowRatingCount,
    highRatingCount,
    distribution,
    productStats,
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [dashboard, setDashboard] = useState<DashboardSummary>(INITIAL_DASHBOARD);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardDays, setDashboardDays] = useState(7);
  const [dashboardRecentLimit, setDashboardRecentLimit] = useState(8);
  const [dashboardLowStockThreshold, setDashboardLowStockThreshold] = useState(5);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userProcessingId, setUserProcessingId] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(0);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userError, setUserError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [productProcessingId, setProductProcessingId] = useState<string | null>(null);
  const [productSearchInput, setProductSearchInput] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<Product>(INITIAL_PRODUCT_FORM);

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderPage, setOrderPage] = useState(0);
  const [orderTotalPages, setOrderTotalPages] = useState(1);
  const [orderSearchInput, setOrderSearchInput] = useState("");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderProcessingId, setOrderProcessingId] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [reviewSearchInput, setReviewSearchInput] = useState("");
  const [reviewSearchTerm, setReviewSearchTerm] = useState("");
  const [reviewProcessingKey, setReviewProcessingKey] = useState<string | null>(null);
  const [loadingRatingAnalytics, setLoadingRatingAnalytics] = useState(false);
  const [ratingAnalyticsError, setRatingAnalyticsError] = useState<string | null>(null);
  const [ratingAnalytics, setRatingAnalytics] = useState<RatingAnalyticsSummary | null>(null);
  const [editingReview, setEditingReview] = useState<AdminReview | null>(null);
  const [reviewEditRating, setReviewEditRating] = useState(5);
  const [reviewEditComment, setReviewEditComment] = useState("");

  const [inventoryHealth, setInventoryHealth] = useState<InventoryHealth | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");
  // ── Audit Logs ──
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditEventTypeFilter, setAuditEventTypeFilter] = useState("");
  const [auditEntityTypeFilter, setAuditEntityTypeFilter] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");

  // ── Queue Monitor ──
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loadingQueues, setLoadingQueues] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  // ── Export ──
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string>("");

  // ── System Health ──
  const [healthData, setHealthData] = useState<SystemHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // ── Notes ──
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [notePinned, setNotePinned] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  // ── Settings ──
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsEditValues, setSettingsEditValues] = useState<Record<string, string>>({});
  const [savingSettingKey, setSavingSettingKey] = useState<string | null>(null);

  const [loadedTabs, setLoadedTabs] = useState<Record<AdminTab, boolean>>({
    overview: false,
    users: false,
    orders: false,
    inventory: false,
    products: false,
    comments: false,
    audit: false,
    queues: false,
    export: false,
    health: false,
    notes: false,
    settings: false,
  });

  const token = useMemo(() => getToken(), []);

  const fetchDashboard = useCallback(async () => {
    if (!token) {
      router.replace("/login");
      return;
    }

    const safeDays = clamp(Number(dashboardDays) || 7, 1, 90);
    const safeRecentLimit = clamp(Number(dashboardRecentLimit) || 8, 1, 20);
    const safeLowStockThreshold = Math.max(1, Number(dashboardLowStockThreshold) || 5);

    setLoadingDashboard(true);
    setDashboardError(null);

    try {
      const params = new URLSearchParams({
        days: String(safeDays),
        recentLimit: String(safeRecentLimit),
        lowStockThreshold: String(safeLowStockThreshold),
      });
      const response = await fetch(`/api/auth/admin-dashboard?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load dashboard");
      }

      const payload = (data?.data ?? data) as Partial<DashboardSummary>;
      setDashboard({
        totalUsers: Number(payload?.totalUsers ?? 0),
        activeUsers: Number(payload?.activeUsers ?? 0),
        totalProducts: Number(payload?.totalProducts ?? 0),
        activeProducts: Number(payload?.activeProducts ?? 0),
        totalOrders: Number(payload?.totalOrders ?? 0),
        totalRevenue: Number(payload?.totalRevenue ?? 0),
        pendingOrders: Number(payload?.pendingOrders ?? 0),
        lowStockProducts: Number(payload?.lowStockProducts ?? 0),
        totalWishlistItems: Number(payload?.totalWishlistItems ?? 0),
        uniqueWishlistUsers: Number(payload?.uniqueWishlistUsers ?? 0),
        averageWishlistSize: Number(payload?.averageWishlistSize ?? 0),
        wishlistAddsByDay: Array.isArray(payload?.wishlistAddsByDay)
          ? payload.wishlistAddsByDay.map((item) => ({
              day: item.day,
              adds: Number(item.adds ?? 0),
            }))
          : [],
        topWishlistedProducts: Array.isArray(payload?.topWishlistedProducts)
          ? payload.topWishlistedProducts.map((item) => ({
              productID: item.productID ?? "",
              productName: item.productName ?? "",
              wishlists: Number(item.wishlists ?? 0),
            }))
          : [],
        topSoldProducts: Array.isArray(payload?.topSoldProducts)
          ? payload.topSoldProducts.map((item) => ({
              productID: item.productID ?? "",
              productName: item.productName ?? "",
              soldQty: Number(item.soldQty ?? 0),
            }))
          : [],
        ratingAnalysis: {
          totalReviews: Number(payload?.ratingAnalysis?.totalReviews ?? 0),
          averageRating: Number(payload?.ratingAnalysis?.averageRating ?? 0),
          lowRatingCount: Number(payload?.ratingAnalysis?.lowRatingCount ?? 0),
          highRatingCount: Number(payload?.ratingAnalysis?.highRatingCount ?? 0),
          distribution: Array.isArray(payload?.ratingAnalysis?.distribution)
            ? payload.ratingAnalysis.distribution.map((item) => ({
                rating: Number(item.rating ?? 0),
                count: Number(item.count ?? 0),
              }))
            : [],
          topReviewedProducts: Array.isArray(payload?.ratingAnalysis?.topReviewedProducts)
            ? payload.ratingAnalysis.topReviewedProducts.map((item) => ({
                productID: item.productID ?? "",
                productName: item.productName ?? "",
                reviewCount: Number(item.reviewCount ?? 0),
                averageRating: Number(item.averageRating ?? 0),
                lowRatingCount: Number(item.lowRatingCount ?? 0),
              }))
            : [],
          lowestRatedProducts: Array.isArray(payload?.ratingAnalysis?.lowestRatedProducts)
            ? payload.ratingAnalysis.lowestRatedProducts.map((item) => ({
                productID: item.productID ?? "",
                productName: item.productName ?? "",
                reviewCount: Number(item.reviewCount ?? 0),
                averageRating: Number(item.averageRating ?? 0),
                lowRatingCount: Number(item.lowRatingCount ?? 0),
              }))
            : [],
        },
        revenueByDay: Array.isArray(payload?.revenueByDay)
          ? payload.revenueByDay.map((item) => ({
              day: item.day,
              orders: Number(item.orders ?? 0),
              revenue: Number(item.revenue ?? 0),
            }))
          : [],
        ordersByStatus: Array.isArray(payload?.ordersByStatus)
          ? payload.ordersByStatus.map((item) => ({
              status: item.status,
              count: Number(item.count ?? 0),
            }))
          : [],
        recentOrders: Array.isArray(payload?.recentOrders)
          ? payload.recentOrders.map((item) => ({
              id: Number(item.id ?? 0),
              orderNumber: item.orderNumber ?? "",
              customerEmail: item.customerEmail ?? "",
              customerName: item.customerName ?? "",
              totalAmount: Number(item.totalAmount ?? 0),
              currency: item.currency ?? "USD",
              paymentStatus: item.paymentStatus ?? "pending",
              orderStatus: item.orderStatus ?? "pending",
              createdAt: item.createdAt ?? "",
            }))
          : [],
      });
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard";
      setDashboardError(message);
      toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
    } finally {
      setLoadingDashboard(false);
    }
  }, [dashboardDays, dashboardLowStockThreshold, dashboardRecentLimit, router, token]);

  const fetchUsers = useCallback(
    async (targetPage: number) => {
      if (!token) {
        router.replace("/login");
        return;
      }

      setLoadingUsers(true);
      setUserError(null);

      try {
        const response = await fetch(`/api/auth/admin?page=${targetPage}&size=10`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          const message = data?.message || data?.error || "Failed to load users";
          throw new Error(message);
        }

        const payload = (data?.data ?? data) as PagedUsers;
        setUsers(payload?.content ?? []);
        setUserPage(payload?.number ?? targetPage);
        setUserTotalPages(Math.max(1, payload?.totalPages ?? 1));
        setLastUpdatedAt(new Date().toISOString());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load users";
        setUserError(message);
        toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
      } finally {
        setLoadingUsers(false);
      }
    },
    [router, token]
  );

  const fetchProducts = useCallback(
    async (keyword: string) => {
      if (!token) {
        router.replace("/login");
        return;
      }

      setLoadingProducts(true);
      setProductError(null);

      try {
        const query = keyword.trim();
        const url = query
          ? `/api/auth/admin-products?q=${encodeURIComponent(query)}`
          : "/api/auth/admin-products";

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || data?.error || "Failed to load products");
        }

        setProducts(
          Array.isArray(data)
            ? data.map((item) => ({
                ...item,
                stockQuantity: Math.max(0, Number(item?.stockQuantity ?? 25)),
                active: item?.active !== false,
              }))
            : []
        );
        setLastUpdatedAt(new Date().toISOString());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load products";
        setProductError(message);
        toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
      } finally {
        setLoadingProducts(false);
      }
    },
    [router, token]
  );

  const fetchOrders = useCallback(
    async (
      targetPage: number,
      overrides?: {
        searchTerm?: string;
        orderStatus?: string;
        paymentStatus?: string;
        dateFrom?: string;
        dateTo?: string;
      }
    ) => {
      if (!token) {
        router.replace("/login");
        return;
      }

      setLoadingOrders(true);
      setOrderError(null);

      try {
        const query = new URLSearchParams({
          page: String(targetPage + 1),
          size: "10",
        });

        const searchTerm = overrides?.searchTerm ?? orderSearchTerm;
        const orderStatus = overrides?.orderStatus ?? orderStatusFilter;
        const paymentStatus = overrides?.paymentStatus ?? paymentStatusFilter;
        const dateFrom = overrides?.dateFrom ?? orderDateFrom;
        const dateTo = overrides?.dateTo ?? orderDateTo;

        if (searchTerm.trim()) query.set("q", searchTerm.trim());
        if (orderStatus) query.set("orderStatus", orderStatus);
        if (paymentStatus) query.set("paymentStatus", paymentStatus);
        if (dateFrom) query.set("dateFrom", dateFrom);
        if (dateTo) query.set("dateTo", dateTo);

        const response = await fetch(`/api/auth/admin-orders?${query.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = (await response.json()) as PagedOrders & { message?: string; error?: string };
        if (!response.ok) {
          throw new Error(data?.message || data?.error || "Failed to load orders");
        }

        setOrders(data?.content ?? []);
        setOrderPage(data?.number ?? targetPage);
        setOrderTotalPages(Math.max(1, data?.totalPages ?? 1));
        setLastUpdatedAt(new Date().toISOString());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load orders";
        setOrderError(message);
        toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
      } finally {
        setLoadingOrders(false);
      }
    },
    [orderDateFrom, orderDateTo, orderSearchTerm, orderStatusFilter, paymentStatusFilter, router, token]
  );

  const fetchReviews = useCallback(
    async (targetPage: number, overrides?: { searchTerm?: string }) => {
      if (!token) {
        router.replace("/login");
        return;
      }

      setLoadingReviews(true);
      setReviewError(null);

      try {
        const query = new URLSearchParams({
          page: String(targetPage + 1),
          size: "10",
        });
        const searchTerm = overrides?.searchTerm ?? reviewSearchTerm;
        if (searchTerm.trim()) {
          query.set("q", searchTerm.trim());
        }

        const response = await fetch(`/api/auth/admin-reviews?${query.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = (await response.json()) as
          | { data?: PagedReviews; message?: string; error?: string }
          | PagedReviews;
        if (!response.ok) {
          const errorData = data as { message?: string; error?: string };
          throw new Error(errorData?.message || errorData?.error || "Failed to load comments");
        }

        const payload = (data as { data?: PagedReviews })?.data ?? (data as PagedReviews);
        setReviews(payload?.content ?? []);
        setReviewPage(payload?.number ?? targetPage);
        setReviewTotalPages(Math.max(1, payload?.totalPages ?? 1));
        setLastUpdatedAt(new Date().toISOString());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load comments";
        setReviewError(message);
        toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
      } finally {
        setLoadingReviews(false);
      }
    },
    [reviewSearchTerm, router, token]
  );

  const fetchRatingAnalytics = useCallback(
    async (overrides?: { searchTerm?: string }) => {
      if (!token) {
        router.replace("/login");
        return;
      }

      setLoadingRatingAnalytics(true);
      setRatingAnalyticsError(null);

      try {
        const searchTerm = overrides?.searchTerm ?? reviewSearchTerm;
        const size = 100;
        let currentPage = 1;
        let totalPages = 1;
        const allReviews: AdminReview[] = [];

        while (currentPage <= totalPages) {
          const query = new URLSearchParams({
            page: String(currentPage),
            size: String(size),
          });
          if (searchTerm.trim()) {
            query.set("q", searchTerm.trim());
          }

          const response = await fetch(`/api/auth/admin-reviews?${query.toString()}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          });

          const data = (await response.json()) as
            | { data?: PagedReviews; message?: string; error?: string }
            | PagedReviews;

          if (!response.ok) {
            const errorData = data as { message?: string; error?: string };
            throw new Error(errorData?.message || errorData?.error || "Failed to load rating analytics");
          }

          const payload = (data as { data?: PagedReviews })?.data ?? (data as PagedReviews);
          const pageItems = Array.isArray(payload?.content) ? payload.content : [];
          allReviews.push(...pageItems);

          totalPages = Math.max(1, Number(payload?.totalPages ?? 1));
          currentPage += 1;
        }

        setRatingAnalytics(buildRatingAnalytics(allReviews));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load rating analytics";
        setRatingAnalyticsError(message);
        toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
      } finally {
        setLoadingRatingAnalytics(false);
      }
    },
    [reviewSearchTerm, router, token]
  );

  const fetchInventoryHealth = useCallback(async () => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoadingInventory(true);
    setInventoryError(null);

    try {
      const safeLowStockThreshold = Math.max(1, Number(dashboardLowStockThreshold) || 5);
      const response = await fetch(`/api/auth/admin-inventory?lowStockThreshold=${safeLowStockThreshold}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load inventory health");
      }
      setInventoryHealth({
        totalProducts: Number(data?.totalProducts ?? 0),
        activeProducts: Number(data?.activeProducts ?? 0),
        totalStock: Number(data?.totalStock ?? 0),
        totalReservedInCarts: Number(data?.totalReservedInCarts ?? 0),
        totalAvailableToSell: Number(data?.totalAvailableToSell ?? 0),
        lowStockThreshold: Number(data?.lowStockThreshold ?? safeLowStockThreshold),
        lowStockCount: Number(data?.lowStockCount ?? 0),
        outOfStockCount: Number(data?.outOfStockCount ?? 0),
        lowStockItems: Array.isArray(data?.lowStockItems) ? data.lowStockItems : [],
        outOfStockItems: Array.isArray(data?.outOfStockItems) ? data.outOfStockItems : [],
        noSalesItems: Array.isArray(data?.noSalesItems) ? data.noSalesItems : [],
        topSellingItems: Array.isArray(data?.topSellingItems) ? data.topSellingItems : [],
      });
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load inventory health";
      setInventoryError(message);
      toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
    } finally {
      setLoadingInventory(false);
    }
  }, [dashboardLowStockThreshold, router, token]);

  const fetchAuditEvents = useCallback(
    async (
      targetPage: number,
      overrides?: { eventType?: string; entityType?: string; dateFrom?: string; dateTo?: string }
    ) => {
      if (!token) { router.replace("/login"); return; }
      setLoadingAudit(true);
      setAuditError(null);
      try {
        const q = new URLSearchParams({ page: String(targetPage + 1), size: "15" });
        const eType = overrides?.eventType ?? auditEventTypeFilter;
        const enType = overrides?.entityType ?? auditEntityTypeFilter;
        const dFrom = overrides?.dateFrom ?? auditDateFrom;
        const dTo = overrides?.dateTo ?? auditDateTo;
        if (eType) q.set("eventType", eType);
        if (enType) q.set("entityType", enType);
        if (dFrom) q.set("dateFrom", dFrom);
        if (dTo) q.set("dateTo", dTo);
        const response = await fetch(`/api/auth/admin-audit?${q.toString()}`, { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
        const data = await response.json() as PagedAudit & { error?: string };
        if (!response.ok) throw new Error(data?.error || "Failed to load audit events");
        setAuditEvents(data?.content ?? []);
        setAuditPage(data?.number ?? targetPage);
        setAuditTotalPages(Math.max(1, data?.totalPages ?? 1));
        setLastUpdatedAt(new Date().toISOString());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load audit events";
        setAuditError(message);
        toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
      } finally { setLoadingAudit(false); }
    },
    [auditDateFrom, auditDateTo, auditEntityTypeFilter, auditEventTypeFilter, router, token]
  );

  const fetchQueues = useCallback(async () => {
    if (!token) { router.replace("/login"); return; }
    setLoadingQueues(true);
    setQueueError(null);
    try {
      const response = await fetch("/api/auth/admin-queues", { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load queues");
      setQueueData(data as QueueData);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load queue data";
      setQueueError(message);
    } finally { setLoadingQueues(false); }
  }, [router, token]);

  const fetchSystemHealth = useCallback(async () => {
    if (!token) { router.replace("/login"); return; }
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const response = await fetch("/api/auth/admin-system-health", { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load system health");
      setHealthData(data as SystemHealth);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load system health";
      setHealthError(message);
    } finally { setLoadingHealth(false); }
  }, [router, token]);

  const fetchNotes = useCallback(async () => {
    if (!token) { router.replace("/login"); return; }
    setLoadingNotes(true);
    setNoteError(null);
    try {
      const response = await fetch("/api/auth/admin-notes?page=1&size=50", { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load notes");
      setNotes(data?.content ?? []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load notes";
      setNoteError(message);
    } finally { setLoadingNotes(false); }
  }, [router, token]);

  const fetchSettings = useCallback(async () => {
    if (!token) { router.replace("/login"); return; }
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      const response = await fetch("/api/auth/admin-settings", { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load settings");
      const items = (data?.settings ?? []) as AdminSetting[];
      setSettings(items);
      const values: Record<string, string> = {};
      items.forEach((s) => { values[s.setting_key] = s.setting_value; });
      setSettingsEditValues(values);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load settings";
      setSettingsError(message);
    } finally { setLoadingSettings(false); }
  }, [router, token]);

  useEffect(() => {
    const syncAuthState = () => {
      const user = getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      if (user.role !== "admin") {
        router.replace("/");
      }
    };

    syncAuthState();
    const unsubscribe = subscribeToAuthChanges(syncAuthState);
    return unsubscribe;
  }, [router, token]);

  useEffect(() => {
    if (loadedTabs[activeTab]) return;

    setLoadedTabs((prev) => ({ ...prev, [activeTab]: true }));

    if (activeTab === "overview") {
      void fetchDashboard();
    } else if (activeTab === "users") {
      void fetchUsers(0);
    } else if (activeTab === "orders") {
      void fetchOrders(0);
    } else if (activeTab === "inventory") {
      void fetchInventoryHealth();
    } else if (activeTab === "products") {
      void fetchProducts("");
    } else if (activeTab === "comments") {
      void Promise.all([fetchReviews(0), fetchRatingAnalytics()]);
    } else if (activeTab === "audit") {
      void fetchAuditEvents(0);
    } else if (activeTab === "queues") {
      void fetchQueues();
    } else if (activeTab === "health") {
      void fetchSystemHealth();
    } else if (activeTab === "notes") {
      void fetchNotes();
    } else if (activeTab === "settings") {
      void fetchSettings();
    }
  }, [
    activeTab,
    fetchAuditEvents,
    fetchDashboard,
    fetchInventoryHealth,
    fetchNotes,
    fetchOrders,
    fetchProducts,
    fetchQueues,
    fetchRatingAnalytics,
    fetchReviews,
    fetchSettings,
    fetchSystemHealth,
    fetchUsers,
    loadedTabs,
  ]);

  useEffect(() => {
    if (activeTab !== "overview" && activeTab !== "orders" && activeTab !== "queues" && activeTab !== "health") return;

    const interval = activeTab === "queues" || activeTab === "health" ? 30000 : 60000;
    const timer = window.setInterval(() => {
      if (activeTab === "overview") void fetchDashboard();
      else if (activeTab === "orders") void fetchOrders(orderPage);
      else if (activeTab === "queues") void fetchQueues();
      else if (activeTab === "health") void fetchSystemHealth();
    }, interval);

    return () => window.clearInterval(timer);
  }, [activeTab, fetchDashboard, fetchOrders, fetchQueues, fetchSystemHealth, orderPage]);

  const handleRefreshActiveTab = useCallback(async () => {
    if (activeTab === "overview") { await fetchDashboard(); return; }
    if (activeTab === "users") { await fetchUsers(userPage); return; }
    if (activeTab === "orders") { await fetchOrders(orderPage); return; }
    if (activeTab === "inventory") { await fetchInventoryHealth(); return; }
    if (activeTab === "products") { await fetchProducts(productSearchTerm); return; }
    if (activeTab === "comments") { await Promise.all([fetchReviews(reviewPage), fetchRatingAnalytics()]); return; }
    if (activeTab === "audit") { await fetchAuditEvents(auditPage); return; }
    if (activeTab === "queues") { await fetchQueues(); return; }
    if (activeTab === "health") { await fetchSystemHealth(); return; }
    if (activeTab === "notes") { await fetchNotes(); return; }
    if (activeTab === "settings") { await fetchSettings(); return; }
  }, [
    activeTab,
    auditPage,
    fetchAuditEvents,
    fetchDashboard,
    fetchInventoryHealth,
    fetchNotes,
    fetchOrders,
    fetchProducts,
    fetchQueues,
    fetchRatingAnalytics,
    fetchReviews,
    fetchSettings,
    fetchSystemHealth,
    fetchUsers,
    orderPage,
    productSearchTerm,
    reviewPage,
    userPage,
  ]);

  const handleToggleUser = async (user: AdminUser) => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setUserProcessingId(user.id);
    try {
      const response = await fetch("/api/auth/admin", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id, active: !user.active }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to update user");
      }

      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, active: !item.active } : item))
      );
      await fetchDashboard();
      toast.success(`User ${user.active ? "deactivated" : "activated"} successfully`, {
        duration: 2000,
        style: { backgroundColor: "#07bc0c", color: "#fff" },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
    } finally {
      setUserProcessingId(null);
    }
  };

  const resetProductForm = () => {
    setProductForm(INITIAL_PRODUCT_FORM);
    setEditingProductId(null);
  };

  const onProductInputChange = (field: keyof Product, value: string) => {
    setProductForm((prev) => ({
      ...prev,
      [field]: field === "productPrice" || field === "stockQuantity" ? Number(value) : value,
    }));
  };

  const handleImageUpload = async (
    field: "frontImg" | "backImg",
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file", {
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
      return;
    }

    try {
      if (field === "frontImg") setUploadingFront(true);
      if (field === "backImg") setUploadingBack(true);

      const imageDataUrl = await fileToDataUrl(file);
      setProductForm((prev) => ({ ...prev, [field]: imageDataUrl }));

      toast.success(`${field === "frontImg" ? "Front" : "Back"} image uploaded`, {
        duration: 1800,
        style: { backgroundColor: "#07bc0c", color: "#fff" },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed", {
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
    } finally {
      if (field === "frontImg") setUploadingFront(false);
      if (field === "backImg") setUploadingBack(false);
      event.target.value = "";
    }
  };

  const handleProductSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTerm = productSearchInput.trim();
    setProductSearchTerm(nextTerm);
    await fetchProducts(nextTerm);
  };

  const handleSaveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      router.replace("/login");
      return;
    }

    if (!productForm.productID.trim() || !productForm.productName.trim()) {
      toast.error("Product ID and Product Name are required", {
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
      return;
    }
    if (productForm.stockQuantity < 0) {
      toast.error("Stock quantity must be >= 0", {
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
      return;
    }

    setIsSavingProduct(true);
    try {
      const method = editingProductId ? "PUT" : "POST";
      const response = await fetch("/api/auth/admin-products", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(productForm),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to save product");
      }

      toast.success(editingProductId ? "Product updated" : "Product created", {
        duration: 2000,
        style: { backgroundColor: "#07bc0c", color: "#fff" },
      });

      resetProductForm();
      await fetchProducts(productSearchTerm);
      await fetchInventoryHealth();
      await fetchDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.productID);
    setProductForm({
      ...product,
      stockQuantity: Math.max(0, Number(product.stockQuantity ?? 25)),
      active: product.active !== false,
    });
  };

  const handleDeleteProduct = async (productID: string) => {
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!window.confirm(`Delete product ${productID}?`)) {
      return;
    }

    setProductProcessingId(productID);
    try {
      const response = await fetch("/api/auth/admin-products", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productID }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to delete product");
      }

      setProducts((prev) => prev.filter((item) => item.productID !== productID));
      toast.success("Product deleted", {
        duration: 2000,
        style: { backgroundColor: "#07bc0c", color: "#fff" },
      });

      if (editingProductId === productID) {
        resetProductForm();
      }
      await fetchInventoryHealth();
      await fetchDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
    } finally {
      setProductProcessingId(null);
    }
  };

  const handleOrderFilterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTerm = orderSearchInput.trim();
    setOrderSearchTerm(nextTerm);
    await fetchOrders(0, { searchTerm: nextTerm });
  };

  const handleOrderFiltersReset = async () => {
    setOrderSearchInput("");
    setOrderSearchTerm("");
    setOrderStatusFilter("");
    setPaymentStatusFilter("");
    setOrderDateFrom("");
    setOrderDateTo("");
    setOrderPage(0);
    await fetchOrders(0, {
      searchTerm: "",
      orderStatus: "",
      paymentStatus: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const handleOrderStatusUpdate = async (
    orderId: number,
    payload: { orderStatus?: string; paymentStatus?: string }
  ) => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setOrderProcessingId(orderId);
    try {
      const response = await fetch("/api/auth/admin-orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, ...payload }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to update order");
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                order_status: payload.orderStatus ?? order.order_status,
                payment_status: payload.paymentStatus ?? order.payment_status,
              }
            : order
        )
      );
      await fetchDashboard();

      toast.success("Order updated", {
        duration: 1800,
        style: { backgroundColor: "#07bc0c", color: "#fff" },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
    } finally {
      setOrderProcessingId(null);
    }
  };

  const handleReviewFilterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTerm = reviewSearchInput.trim();
    setReviewSearchTerm(nextTerm);
    await Promise.all([
      fetchReviews(0, { searchTerm: nextTerm }),
      fetchRatingAnalytics({ searchTerm: nextTerm }),
    ]);
  };

  const startEditReview = (review: AdminReview) => {
    setEditingReview(review);
    setReviewEditRating(Math.max(1, Math.min(5, Number(review.rating ?? 5))));
    setReviewEditComment(review.comment ?? "");
  };

  const cancelEditReview = () => {
    setEditingReview(null);
    setReviewEditRating(5);
    setReviewEditComment("");
  };

  const handleAdminUpdateReview = async () => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!editingReview) {
      return;
    }
    const trimmedComment = reviewEditComment.trim();
    if (trimmedComment.length < 2) {
      toast.error("Comment must be at least 2 characters", {
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
      return;
    }

    const key = `${editingReview.productID}:${editingReview.reviewID}`;
    setReviewProcessingKey(key);
    try {
      const response = await fetch("/api/auth/admin-reviews", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productID: editingReview.productID,
          reviewID: editingReview.reviewID,
          rating: Math.max(1, Math.min(5, reviewEditRating)),
          comment: trimmedComment,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to update comment");
      }

      setReviews((prev) =>
        prev.map((item) =>
          item.productID === editingReview.productID && item.reviewID === editingReview.reviewID
            ? {
                ...item,
                rating: Math.max(1, Math.min(5, reviewEditRating)),
                comment: trimmedComment,
              }
            : item
        )
      );
      toast.success("Comment updated", {
        duration: 1800,
        style: { backgroundColor: "#07bc0c", color: "#fff" },
      });
      cancelEditReview();
      await fetchRatingAnalytics();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update comment", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
    } finally {
      setReviewProcessingKey(null);
    }
  };

  const handleAdminDeleteReview = async (review: AdminReview) => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!window.confirm(`Delete this comment from ${review.author || "user"}?`)) {
      return;
    }

    const key = `${review.productID}:${review.reviewID}`;
    setReviewProcessingKey(key);
    try {
      const response = await fetch("/api/auth/admin-reviews", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productID: review.productID,
          reviewID: review.reviewID,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to delete comment");
      }

      setReviews((prev) =>
        prev.filter((item) => !(item.productID === review.productID && item.reviewID === review.reviewID))
      );
      if (
        editingReview &&
        editingReview.productID === review.productID &&
        editingReview.reviewID === review.reviewID
      ) {
        cancelEditReview();
      }

      toast.success("Comment deleted", {
        duration: 1800,
        style: { backgroundColor: "#07bc0c", color: "#fff" },
      });
      await Promise.all([fetchDashboard(), fetchRatingAnalytics()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete comment", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" },
      });
    } finally {
      setReviewProcessingKey(null);
    }
  };

  const statusCountMap = useMemo(() => {
    const map = new Map<string, number>();
    dashboard.ordersByStatus.forEach((item) => {
      map.set(item.status, item.count);
    });
    return map;
  }, [dashboard.ordersByStatus]);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayRevenue = useMemo(
    () =>
      dashboard.revenueByDay
        .filter((point) => point.day.startsWith(todayKey))
        .reduce((sum, point) => sum + Number(point.revenue || 0), 0),
    [dashboard.revenueByDay, todayKey]
  );

  const todayOrders = useMemo(
    () =>
      dashboard.revenueByDay
        .filter((point) => point.day.startsWith(todayKey))
        .reduce((sum, point) => sum + Number(point.orders || 0), 0),
    [dashboard.revenueByDay, todayKey]
  );

  const averageOrderValue = useMemo(() => {
    if (dashboard.totalOrders <= 0) return 0;
    return dashboard.totalRevenue / dashboard.totalOrders;
  }, [dashboard.totalOrders, dashboard.totalRevenue]);

  const completedOrders = statusCountMap.get("completed") || 0;
  const cancelledOrders = statusCountMap.get("cancelled") || 0;
  const conversionRate = dashboard.totalOrders > 0 ? (completedOrders / dashboard.totalOrders) * 100 : 0;

  const failedPayments = useMemo(
    () => dashboard.recentOrders.filter((order) => order.paymentStatus === "failed").length,
    [dashboard.recentOrders]
  );
  const refundedPayments = useMemo(
    () => dashboard.recentOrders.filter((order) => order.paymentStatus === "refunded").length,
    [dashboard.recentOrders]
  );

  const uniqueCustomers = useMemo(
    () => new Set(dashboard.recentOrders.map((order) => order.customerEmail).filter(Boolean)).size,
    [dashboard.recentOrders]
  );

  const repeatCustomerCount = useMemo(() => {
    const counts = new Map<string, number>();
    dashboard.recentOrders.forEach((order) => {
      if (!order.customerEmail) return;
      counts.set(order.customerEmail, (counts.get(order.customerEmail) || 0) + 1);
    });
    return Array.from(counts.values()).filter((count) => count > 1).length;
  }, [dashboard.recentOrders]);

  const newCustomerCount = Math.max(0, uniqueCustomers - repeatCustomerCount);

  const maxRevenuePoint = useMemo(
    () => Math.max(...dashboard.revenueByDay.map((point) => Number(point.revenue || 0)), 1),
    [dashboard.revenueByDay]
  );
  const maxWishlistAddsPoint = useMemo(
    () => Math.max(...dashboard.wishlistAddsByDay.map((point) => Number(point.adds || 0)), 1),
    [dashboard.wishlistAddsByDay]
  );

  const funnelSteps = useMemo(
    () => [
      { label: "Pending", value: statusCountMap.get("pending") || 0 },
      { label: "Processing", value: statusCountMap.get("processing") || 0 },
      { label: "Paid", value: statusCountMap.get("paid") || 0 },
      { label: "Shipped", value: statusCountMap.get("shipped") || 0 },
      { label: "Completed", value: completedOrders },
    ],
    [completedOrders, statusCountMap]
  );
  const maxFunnelValue = Math.max(...funnelSteps.map((step) => step.value), 1);

  const actionItems = useMemo(
    () => [
      {
        label: "Pending orders",
        value: dashboard.pendingOrders,
        detail: "Need fulfillment or review",
        severity: dashboard.pendingOrders > 10 ? "high" : dashboard.pendingOrders > 0 ? "medium" : "low",
        tab: "orders" as AdminTab,
      },
      {
        label: "Low stock products",
        value: dashboard.lowStockProducts,
        detail: `At or below threshold (${dashboardLowStockThreshold})`,
        severity: dashboard.lowStockProducts > 8 ? "high" : dashboard.lowStockProducts > 0 ? "medium" : "low",
        tab: "inventory" as AdminTab,
      },
      {
        label: "Failed payments (recent)",
        value: failedPayments,
        detail: "Orders that require payment recovery",
        severity: failedPayments > 0 ? "high" : "low",
        tab: "orders" as AdminTab,
      },
      {
        label: "Cancelled orders",
        value: cancelledOrders,
        detail: "Potential CX or fulfillment issue",
        severity: cancelledOrders > 0 ? "medium" : "low",
        tab: "orders" as AdminTab,
      },
    ],
    [
      cancelledOrders,
      dashboard.lowStockProducts,
      dashboard.pendingOrders,
      dashboardLowStockThreshold,
      failedPayments,
    ]
  );

  const alerts = useMemo(() => {
    const list: string[] = [];
    if (dashboard.pendingOrders > 15) list.push("High pending-order queue detected. Prioritize fulfillment.");
    if (dashboard.lowStockProducts > 10) list.push("Low-stock risk is elevated. Trigger restock workflow.");
    if (failedPayments > 0) list.push(`${failedPayments} failed payment(s) in recent orders.`);
    if (refundedPayments > 0) list.push(`${refundedPayments} refunded payment(s) in recent orders.`);
    if (list.length === 0) list.push("No urgent operational alerts.");
    return list;
  }, [dashboard.lowStockProducts, dashboard.pendingOrders, failedPayments, refundedPayments]);

  // ── Audit Handlers ──
  const handleAuditFilterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuditPage(0);
    await fetchAuditEvents(0);
  };

  const handleAuditFilterReset = async () => {
    setAuditEventTypeFilter("");
    setAuditEntityTypeFilter("");
    setAuditDateFrom("");
    setAuditDateTo("");
    setAuditPage(0);
    await fetchAuditEvents(0, { eventType: "", entityType: "", dateFrom: "", dateTo: "" });
  };

  // ── CSV Export ──
  const triggerCsvDownload = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (value: unknown): string => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportOrders = async () => {
    if (!token) return;
    setExportingKey("orders");
    setExportStatus("");
    try {
      const response = await fetch("/api/auth/admin-orders?page=1&size=1000", {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      const items = (data?.content ?? []) as AdminOrder[];
      const headers = ["Order Number", "Customer Email", "Customer Name", "Total", "Currency", "Payment Method", "Payment Status", "Order Status", "Items", "Created At"];
      const rows = items.map((o) => [o.order_number, o.customer_email, [o.customer_first_name, o.customer_last_name].filter(Boolean).join(" "), o.total_amount, o.currency, o.payment_method, o.payment_status, o.order_status, o.item_count, o.created_at].map(escapeCsv).join(","));
      triggerCsvDownload(`orders_export_${new Date().toISOString().slice(0, 10)}.csv`, [headers.join(","), ...rows].join("\n"));
      setExportStatus("Orders exported successfully!");
      toast.success("Orders CSV downloaded", { duration: 2000, style: { backgroundColor: "#07bc0c", color: "#fff" } });
    } catch { setExportStatus("Export failed"); } finally { setExportingKey(null); }
  };

  const handleExportUsers = async () => {
    if (!token) return;
    setExportingKey("users");
    setExportStatus("");
    try {
      const response = await fetch("/api/auth/admin?page=0&size=1000", {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const payload = (data?.data ?? data) as PagedUsers;
      const items = payload?.content ?? [];
      const headers = ["Email", "First Name", "Last Name", "Active"];
      const rows = items.map((u) => [u.email, u.firstName || "", u.lastName || "", u.active].map(escapeCsv).join(","));
      triggerCsvDownload(`users_export_${new Date().toISOString().slice(0, 10)}.csv`, [headers.join(","), ...rows].join("\n"));
      setExportStatus("Users exported successfully!");
      toast.success("Users CSV downloaded", { duration: 2000, style: { backgroundColor: "#07bc0c", color: "#fff" } });
    } catch { setExportStatus("Export failed"); } finally { setExportingKey(null); }
  };

  const handleExportProducts = async () => {
    if (!token) return;
    setExportingKey("products");
    setExportStatus("");
    try {
      const response = await fetch("/api/auth/admin-products", {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      const items = (Array.isArray(data) ? data : []) as Product[];
      const headers = ["Product ID", "Name", "Price", "Stock", "Active", "Reviews"];
      const rows = items.map((p) => [p.productID, p.productName, p.productPrice, p.stockQuantity, p.active, p.productReviews].map(escapeCsv).join(","));
      triggerCsvDownload(`products_export_${new Date().toISOString().slice(0, 10)}.csv`, [headers.join(","), ...rows].join("\n"));
      setExportStatus("Products exported successfully!");
      toast.success("Products CSV downloaded", { duration: 2000, style: { backgroundColor: "#07bc0c", color: "#fff" } });
    } catch { setExportStatus("Export failed"); } finally { setExportingKey(null); }
  };

  const handleExportReviews = async () => {
    if (!token) return;
    setExportingKey("reviews");
    setExportStatus("");
    try {
      const response = await fetch("/api/auth/admin-reviews?page=1&size=1000", {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const raw = await response.json();
      const payload = (raw as { data?: PagedReviews })?.data ?? (raw as PagedReviews);
      const items = payload?.content ?? [];
      const headers = ["Product ID", "Review ID", "Author", "Rating", "Comment", "Created At"];
      const rows = items.map((r) => [r.productID, r.reviewID, r.author, r.rating, r.comment, r.createdAt].map(escapeCsv).join(","));
      triggerCsvDownload(`reviews_export_${new Date().toISOString().slice(0, 10)}.csv`, [headers.join(","), ...rows].join("\n"));
      setExportStatus("Reviews exported successfully!");
      toast.success("Reviews CSV downloaded", { duration: 2000, style: { backgroundColor: "#07bc0c", color: "#fff" } });
    } catch { setExportStatus("Export failed"); } finally { setExportingKey(null); }
  };

  // ── Notes Handlers ──
  const resetNoteForm = () => {
    setNoteTitle("");
    setNoteContent("");
    setNotePinned(false);
    setEditingNoteId(null);
  };

  const handleSaveNote = async () => {
    if (!token) return;
    if (!noteTitle.trim() && !noteContent.trim()) {
      toast.error("Title or content is required", { style: { backgroundColor: "#fb0404", color: "#fff" } });
      return;
    }
    setSavingNote(true);
    try {
      const method = editingNoteId ? "PUT" : "POST";
      const body = editingNoteId
        ? { id: editingNoteId, title: noteTitle, content: noteContent, is_pinned: notePinned }
        : { title: noteTitle, content: noteContent, is_pinned: notePinned };
      const response = await fetch("/api/auth/admin-notes", {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to save note");
      toast.success(editingNoteId ? "Note updated" : "Note created", { duration: 2000, style: { backgroundColor: "#07bc0c", color: "#fff" } });
      resetNoteForm();
      await fetchNotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save note", { duration: 2500, style: { backgroundColor: "#fb0404", color: "#fff" } });
    } finally { setSavingNote(false); }
  };

  const handleEditNote = (note: AdminNote) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNotePinned(note.is_pinned);
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!token) return;
    if (!window.confirm("Delete this note?")) return;
    try {
      const response = await fetch("/api/auth/admin-notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: noteId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to delete note");
      toast.success("Note deleted", { duration: 1800, style: { backgroundColor: "#07bc0c", color: "#fff" } });
      if (editingNoteId === noteId) resetNoteForm();
      await fetchNotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete note", { duration: 2500, style: { backgroundColor: "#fb0404", color: "#fff" } });
    }
  };

  const handleTogglePin = async (note: AdminNote) => {
    if (!token) return;
    try {
      const response = await fetch("/api/auth/admin-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: note.id, is_pinned: !note.is_pinned }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to update note");
      toast.success(note.is_pinned ? "Note unpinned" : "Note pinned", { duration: 1500, style: { backgroundColor: "#07bc0c", color: "#fff" } });
      await fetchNotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pin note", { duration: 2500, style: { backgroundColor: "#fb0404", color: "#fff" } });
    }
  };

  // ── Settings Handler ──
  const handleSaveSetting = async (key: string) => {
    if (!token) return;
    setSavingSettingKey(key);
    try {
      const response = await fetch("/api/auth/admin-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ setting_key: key, setting_value: settingsEditValues[key] ?? "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to update setting");
      toast.success(`Setting "${key}" updated`, { duration: 2000, style: { backgroundColor: "#07bc0c", color: "#fff" } });
      await fetchSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save setting", { duration: 2500, style: { backgroundColor: "#fb0404", color: "#fff" } });
    } finally { setSavingSettingKey(null); }
  };

  const ratingDistributionRows = useMemo(() => {
    const total = ratingAnalytics?.totalReviews ?? 0;
    return [5, 4, 3, 2, 1].map((rating) => {
      const count = ratingAnalytics?.distribution[rating as RatingBucket] ?? 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      return {
        rating,
        count,
        percentage,
      };
    });
  }, [ratingAnalytics]);

  const topRatedProducts = useMemo(() => {
    const stats = ratingAnalytics?.productStats ?? [];
    return stats
      .filter((item) => item.reviewCount >= 2)
      .sort((a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount)
      .slice(0, 5);
  }, [ratingAnalytics]);

  const lowestRatedProducts = useMemo(() => {
    const stats = ratingAnalytics?.productStats ?? [];
    return stats
      .filter((item) => item.reviewCount >= 2)
      .sort((a, b) => a.averageRating - b.averageRating || b.reviewCount - a.reviewCount)
      .slice(0, 5);
  }, [ratingAnalytics]);

  return (
    <div className="adminPage">
      <div className="adminContainer">
        <div className="adminHeader">
          <h1>Admin Dashboard</h1>
          <p>Manage users, orders, and product data.</p>
        </div>

        <div className="adminTopBar">
          <button className="pageButton" onClick={() => void handleRefreshActiveTab()}>
            Refresh Current Tab
          </button>
          <span className="syncText">
            Last updated: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "Not synced yet"}
          </span>
        </div>

        <div className="adminTabs">
          <button
            className={`tabButton ${activeTab === "overview" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`tabButton ${activeTab === "users" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            Users
          </button>
          <button
            className={`tabButton ${activeTab === "orders" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            Orders
          </button>
          <button
            className={`tabButton ${activeTab === "inventory" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("inventory")}
          >
            Inventory
          </button>
          <button
            className={`tabButton ${activeTab === "products" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("products")}
          >
            Products
          </button>
          <button
            className={`tabButton ${activeTab === "comments" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("comments")}
          >
            Comments
          </button>
          <button
            className={`tabButton ${activeTab === "audit" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("audit")}
          >
            Audit Logs
          </button>
          <button
            className={`tabButton ${activeTab === "queues" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("queues")}
          >
            Queues
          </button>
          <button
            className={`tabButton ${activeTab === "export" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("export")}
          >
            Export
          </button>
          <button
            className={`tabButton ${activeTab === "health" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("health")}
          >
            Health
          </button>
          <button
            className={`tabButton ${activeTab === "notes" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("notes")}
          >
            Notes
          </button>
          <button
            className={`tabButton ${activeTab === "settings" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
        </div>

        {activeTab === "overview" ? (
          <>
            <div className="overviewControlRow">
              <label className="fieldLabel">
                Range
                <select
                  className="productInput"
                  value={dashboardDays}
                  onChange={(event) => setDashboardDays(clamp(Number(event.target.value) || 7, 1, 90))}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </label>
              <label className="fieldLabel">
                Recent Orders
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="productInput"
                  value={dashboardRecentLimit}
                  onChange={(event) => setDashboardRecentLimit(clamp(Number(event.target.value) || 8, 1, 20))}
                />
              </label>
              <label className="fieldLabel">
                Low Stock Threshold
                <input
                  type="number"
                  min={1}
                  className="productInput"
                  value={dashboardLowStockThreshold}
                  onChange={(event) =>
                    setDashboardLowStockThreshold(Math.max(1, Number(event.target.value) || 5))
                  }
                />
              </label>
              <button className="adminActionButton" onClick={() => void fetchDashboard()}>
                Apply Overview Filters
              </button>
            </div>

            {loadingDashboard ? <p className="adminStatus">Loading dashboard overview...</p> : null}
            {dashboardError ? <p className="adminStatus adminStatusError">{dashboardError}</p> : null}

            {!loadingDashboard && !dashboardError ? (
              <>
                <div className="overviewCards">
                  <div className="overviewCard">
                    <p>Today Sales</p>
                    <h3>{formatCurrency(todayRevenue)}</h3>
                    <span>Orders today: {todayOrders}</span>
                  </div>
                  <div className="overviewCard">
                    <p>Orders ({dashboardDays}d)</p>
                    <h3>{dashboard.totalOrders}</h3>
                    <span>{dashboard.pendingOrders} pending action</span>
                  </div>
                  <div className="overviewCard overviewCardRevenue">
                    <p>Average Order Value</p>
                    <h3>{formatCurrency(averageOrderValue)}</h3>
                    <span>Total revenue: {formatCurrency(dashboard.totalRevenue)}</span>
                  </div>
                  <div className="overviewCard">
                    <p>Completion Rate</p>
                    <h3>{conversionRate.toFixed(1)}%</h3>
                    <span>{completedOrders} completed orders</span>
                  </div>
                  <div className="overviewCard overviewCardWarning">
                    <p>Refund/Failure Risk</p>
                    <h3>{refundedPayments + failedPayments}</h3>
                    <span>{failedPayments} failed, {refundedPayments} refunded</span>
                  </div>
                  <div className="overviewCard">
                    <p>Wishlist Items</p>
                    <h3>{dashboard.totalWishlistItems}</h3>
                    <span>{dashboard.uniqueWishlistUsers} users with wishlist activity</span>
                  </div>
                </div>

                <div className="overviewSections">
                  <div className="overviewSection">
                    <h3>Action Required</h3>
                    <div className="actionList">
                      {actionItems.map((item) => (
                        <button
                          key={item.label}
                          className={`actionItem actionItem-${item.severity}`}
                          onClick={() => setActiveTab(item.tab)}
                        >
                          <strong>{item.label}</strong>
                          <span>{item.value}</span>
                          <small>{item.detail}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overviewSection">
                    <h3>Revenue Trend ({dashboardDays}d)</h3>
                    <div className="trendBars">
                      {dashboard.revenueByDay.length === 0 ? (
                        <span className="statusPill">No revenue data</span>
                      ) : (
                        dashboard.revenueByDay.map((point) => (
                          <div key={point.day} className="trendBarItem">
                            <div
                              className="trendBarFill"
                              style={{
                                height: `${Math.max((Number(point.revenue || 0) / maxRevenuePoint) * 100, 6)}%`,
                              }}
                              title={`${point.day}: ${formatCurrency(point.revenue)}`}
                            />
                            <label>{point.day.slice(5)}</label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="overviewSections">
                  <div className="overviewSection">
                    <h3>Order Funnel</h3>
                    <div className="funnelList">
                      {funnelSteps.map((step) => (
                        <div key={step.label} className="funnelRow">
                          <div className="funnelLabel">
                            <span>{step.label}</span>
                            <strong>{step.value}</strong>
                          </div>
                          <div className="funnelBarTrack">
                            <div
                              className="funnelBarFill"
                              style={{ width: `${(step.value / maxFunnelValue) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="overviewSection">
                    <h3>Customer Insights</h3>
                    <div className="insightGrid">
                      <div className="insightCard">
                        <p>Recent Unique Customers</p>
                        <h4>{uniqueCustomers}</h4>
                      </div>
                      <div className="insightCard">
                        <p>New Customers (Recent)</p>
                        <h4>{newCustomerCount}</h4>
                      </div>
                      <div className="insightCard">
                        <p>Returning Customers (Recent)</p>
                        <h4>{repeatCustomerCount}</h4>
                      </div>
                      <div className="insightCard">
                        <p>Active Products</p>
                        <h4>
                          {dashboard.activeProducts}/{dashboard.totalProducts}
                        </h4>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overviewSections">
                  <div className="overviewSection">
                    <h3>Operational Alerts</h3>
                    <ul className="alertsList">
                      {alerts.map((alert) => (
                        <li key={alert}>{alert}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="overviewSection">
                    <h3>Quick Actions</h3>
                    <div className="quickActions">
                      <button className="pageButton" onClick={() => setActiveTab("orders")}>
                        Review Orders
                      </button>
                      <button className="pageButton" onClick={() => setActiveTab("inventory")}>
                        Check Inventory
                      </button>
                      <button className="pageButton" onClick={() => setActiveTab("products")}>
                        Update Products
                      </button>
                      <button className="pageButton" onClick={() => setActiveTab("users")}>
                        Manage Users
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overviewSections">
                  <div className="overviewSection">
                    <h3>Wishlist Trend ({dashboardDays}d)</h3>
                    <div className="trendBars">
                      {dashboard.wishlistAddsByDay.length === 0 ? (
                        <span className="statusPill">No wishlist activity data</span>
                      ) : (
                        dashboard.wishlistAddsByDay.map((point) => (
                          <div key={`wishlist-${point.day}`} className="trendBarItem">
                            <div
                              className="trendBarFill wishlistTrendFill"
                              style={{
                                height: `${Math.max((Number(point.adds || 0) / maxWishlistAddsPoint) * 100, 6)}%`,
                              }}
                              title={`${point.day}: ${point.adds} wishlist adds`}
                            />
                            <label>{point.day.slice(5)}</label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="overviewSection">
                    <h3>Wishlist Analysis</h3>
                    <div className="insightGrid">
                      <div className="insightCard">
                        <p>Unique Wishlist Users</p>
                        <h4>{dashboard.uniqueWishlistUsers}</h4>
                      </div>
                      <div className="insightCard">
                        <p>Avg Items per User</p>
                        <h4>{dashboard.averageWishlistSize.toFixed(2)}</h4>
                      </div>
                    </div>
                    <div className="adminTableWrapper">
                      <table className="adminTable compactTable">
                        <thead>
                          <tr>
                            <th>Product ID</th>
                            <th>Name</th>
                            <th>Wishlists</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.topWishlistedProducts.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="adminEmpty">
                                No wishlist data yet.
                              </td>
                            </tr>
                          ) : (
                            dashboard.topWishlistedProducts.map((item) => (
                              <tr key={`wish-${item.productID}`}>
                                <td>{item.productID}</td>
                                <td>{item.productName || "-"}</td>
                                <td>{item.wishlists}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="overviewSection">
                  <h3>Top Sold Products</h3>
                  <div className="adminTableWrapper">
                    <table className="adminTable compactTable">
                      <thead>
                        <tr>
                          <th>Product ID</th>
                          <th>Name</th>
                          <th>Sold Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.topSoldProducts.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="adminEmpty">
                              No sold-product data yet.
                            </td>
                          </tr>
                        ) : (
                          dashboard.topSoldProducts.map((item) => (
                            <tr key={`sold-${item.productID}`}>
                              <td>{item.productID}</td>
                              <td>{item.productName || "-"}</td>
                              <td>{item.soldQty}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="overviewSections">
                  <div className="overviewSection">
                    <h3>Rating Summary</h3>
                    <div className="insightGrid">
                      <div className="insightCard">
                        <p>Total Reviews</p>
                        <h4>{dashboard.ratingAnalysis.totalReviews}</h4>
                      </div>
                      <div className="insightCard">
                        <p>Average Rating</p>
                        <h4>{dashboard.ratingAnalysis.averageRating.toFixed(2)} / 5</h4>
                      </div>
                      <div className="insightCard">
                        <p>Low Ratings (1-2)</p>
                        <h4>{dashboard.ratingAnalysis.lowRatingCount}</h4>
                      </div>
                      <div className="insightCard">
                        <p>High Ratings (4-5)</p>
                        <h4>{dashboard.ratingAnalysis.highRatingCount}</h4>
                      </div>
                    </div>
                    <div className="adminTableWrapper">
                      <table className="adminTable compactTable">
                        <thead>
                          <tr>
                            <th>Stars</th>
                            <th>Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.ratingAnalysis.distribution.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="adminEmpty">No rating distribution data.</td>
                            </tr>
                          ) : (
                            dashboard.ratingAnalysis.distribution.map((item) => (
                              <tr key={`rating-dist-${item.rating}`}>
                                <td>{item.rating}</td>
                                <td>{item.count}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="overviewSection">
                    <h3>Lowest Rated Products</h3>
                    <div className="adminTableWrapper">
                      <table className="adminTable compactTable">
                        <thead>
                          <tr>
                            <th>Product ID</th>
                            <th>Name</th>
                            <th>Avg Rating</th>
                            <th>Reviews</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.ratingAnalysis.lowestRatedProducts.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="adminEmpty">No product rating data yet.</td>
                            </tr>
                          ) : (
                            dashboard.ratingAnalysis.lowestRatedProducts.map((item) => (
                              <tr key={`rating-low-${item.productID}`}>
                                <td>{item.productID}</td>
                                <td>{item.productName || "-"}</td>
                                <td>{item.averageRating.toFixed(2)}</td>
                                <td>{item.reviewCount}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="overviewSection">
                  <h3>Recent Orders</h3>
                  <div className="adminTableWrapper">
                    <table className="adminTable">
                      <thead>
                        <tr>
                          <th>Order #</th>
                          <th>Customer</th>
                          <th>Total</th>
                          <th>Payment</th>
                          <th>Status</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.recentOrders.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="adminEmpty">
                              No recent orders yet.
                            </td>
                          </tr>
                        ) : (
                          dashboard.recentOrders.map((order) => (
                            <tr key={order.id}>
                              <td>{order.orderNumber}</td>
                              <td>
                                <div>{order.customerName || "-"}</div>
                                <div className="mutedCell">{order.customerEmail}</div>
                              </td>
                              <td>{formatCurrency(order.totalAmount, order.currency)}</td>
                              <td>
                                <span className={`paymentBadge paymentBadge-${order.paymentStatus}`}>
                                  {order.paymentStatus}
                                </span>
                              </td>
                              <td>
                                <span className={`orderBadge orderBadge-${order.orderStatus}`}>
                                  {order.orderStatus}
                                </span>
                              </td>
                              <td>{formatDateTime(order.createdAt)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : activeTab === "users" ? (
          <>
            {loadingUsers ? <p className="adminStatus">Loading users...</p> : null}
            {userError ? <p className="adminStatus adminStatusError">{userError}</p> : null}

            {!loadingUsers && !userError ? (
              <>
                <div className="adminTableWrapper">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="adminEmpty">
                            No users found.
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => {
                          const isProcessing = userProcessingId === user.id;
                          return (
                            <tr key={user.id}>
                              <td>{user.email}</td>
                              <td>{[user.firstName, user.lastName].filter(Boolean).join(" ") || "-"}</td>
                              <td>
                                <span className={user.active ? "statusActive" : "statusInactive"}>
                                  {user.active ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="adminActionButton"
                                  disabled={isProcessing}
                                  onClick={() => handleToggleUser(user)}
                                >
                                  {isProcessing ? "Processing..." : user.active ? "Deactivate" : "Activate"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="adminPagination">
                  <button
                    className="pageButton"
                    disabled={userPage <= 0}
                    onClick={() => fetchUsers(userPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {userPage + 1} / {userTotalPages}
                  </span>
                  <button
                    className="pageButton"
                    disabled={userPage + 1 >= userTotalPages}
                    onClick={() => fetchUsers(userPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : null}
          </>
        ) : activeTab === "orders" ? (
          <>
            <form className="orderFilterRow" onSubmit={handleOrderFilterSubmit}>
              <input
                type="text"
                value={orderSearchInput}
                onChange={(event) => setOrderSearchInput(event.target.value)}
                placeholder="Search by order number or customer email"
                className="productInput"
              />
              <select
                className="productInput"
                value={orderStatusFilter}
                onChange={(event) => setOrderStatusFilter(event.target.value)}
              >
                <option value="">All Order Statuses</option>
                {ORDER_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                className="productInput"
                value={paymentStatusFilter}
                onChange={(event) => setPaymentStatusFilter(event.target.value)}
              >
                <option value="">All Payment Statuses</option>
                {PAYMENT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="productInput"
                value={orderDateFrom}
                onChange={(event) => setOrderDateFrom(event.target.value)}
              />
              <input
                type="date"
                className="productInput"
                value={orderDateTo}
                onChange={(event) => setOrderDateTo(event.target.value)}
              />
              <button type="submit" className="pageButton">
                Apply
              </button>
              <button type="button" className="pageButton" onClick={handleOrderFiltersReset}>
                Reset
              </button>
            </form>

            {loadingOrders ? <p className="adminStatus">Loading orders...</p> : null}
            {orderError ? <p className="adminStatus adminStatusError">{orderError}</p> : null}

            {!loadingOrders && !orderError ? (
              <>
                <div className="adminTableWrapper">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Order Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="adminEmpty">
                            No orders found.
                          </td>
                        </tr>
                      ) : (
                        orders.map((order) => {
                          const isProcessing = orderProcessingId === order.id;
                          const isExpanded = expandedOrderId === order.id;
                          const customerName =
                            [order.customer_first_name, order.customer_last_name].filter(Boolean).join(" ") || "-";
                          const addressLine = [
                            order.shipping_address_line1,
                            order.shipping_address_line2,
                            order.shipping_city,
                            order.shipping_state,
                            order.shipping_postal_code,
                            order.shipping_country,
                          ]
                            .filter(Boolean)
                            .join(", ");

                          return (
                            <Fragment key={order.id}>
                              <tr>
                                <td>{order.order_number}</td>
                                <td>
                                  <div>{customerName}</div>
                                  <div className="mutedCell">{order.customer_email}</div>
                                </td>
                                <td>{order.item_count}</td>
                                <td>
                                  {order.currency} {Number(order.total_amount).toFixed(2)}
                                </td>
                                <td>
                                  <span className={`paymentBadge paymentBadge-${order.payment_status}`}>
                                    {order.payment_status}
                                  </span>
                                </td>
                                <td>
                                  <span className={`orderBadge orderBadge-${order.order_status}`}>
                                    {order.order_status}
                                  </span>
                                </td>
                                <td>{formatDateTime(order.created_at)}</td>
                                <td>
                                  <div className="rowActions">
                                    <button
                                      type="button"
                                      className="pageButton"
                                      onClick={() =>
                                        setExpandedOrderId((prev) => (prev === order.id ? null : order.id))
                                      }
                                    >
                                      {isExpanded ? "Hide Detail" : "View Detail"}
                                    </button>
                                    <select
                                      className="statusSelect"
                                      value={order.order_status}
                                      disabled={isProcessing}
                                      onChange={(event) =>
                                        handleOrderStatusUpdate(order.id, {
                                          orderStatus: event.target.value,
                                        })
                                      }
                                    >
                                      {ORDER_STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>
                                          {status}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      className="statusSelect"
                                      value={order.payment_status}
                                      disabled={isProcessing}
                                      onChange={(event) =>
                                        handleOrderStatusUpdate(order.id, {
                                          paymentStatus: event.target.value,
                                        })
                                      }
                                    >
                                      {PAYMENT_STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>
                                          {status}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded ? (
                                <tr className="orderDetailRow">
                                  <td colSpan={8}>
                                    <div className="orderDetailGrid">
                                      <div>
                                        <p className="orderDetailLabel">Phone</p>
                                        <p>{order.customer_phone || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="orderDetailLabel">Payment Method</p>
                                        <p>{order.payment_method || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="orderDetailLabel">Shipping Address</p>
                                        <p>{addressLine || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="orderDetailLabel">Notes</p>
                                        <p>{order.notes || "-"}</p>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="adminPagination">
                  <button
                    className="pageButton"
                    disabled={orderPage <= 0}
                    onClick={() => fetchOrders(orderPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {orderPage + 1} / {orderTotalPages}
                  </span>
                  <button
                    className="pageButton"
                    disabled={orderPage + 1 >= orderTotalPages}
                    onClick={() => fetchOrders(orderPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : null}
          </>
        ) : activeTab === "inventory" ? (
          <>
            {loadingInventory ? <p className="adminStatus">Loading inventory health...</p> : null}
            {inventoryError ? <p className="adminStatus adminStatusError">{inventoryError}</p> : null}

            {!loadingInventory && !inventoryError && inventoryHealth ? (
              <>
                <div className="inventoryCards">
                  <div className="inventoryCard">
                    <p>Total Products</p>
                    <h3>{inventoryHealth.totalProducts}</h3>
                  </div>
                  <div className="inventoryCard">
                    <p>Active Products</p>
                    <h3>{inventoryHealth.activeProducts}</h3>
                  </div>
                  <div className="inventoryCard">
                    <p>Total Stock Units</p>
                    <h3>{inventoryHealth.totalStock}</h3>
                  </div>
                  <div className="inventoryCard">
                    <p>Reserved In Carts</p>
                    <h3>{inventoryHealth.totalReservedInCarts}</h3>
                  </div>
                  <div className="inventoryCard">
                    <p>Available To Sell</p>
                    <h3>{inventoryHealth.totalAvailableToSell}</h3>
                  </div>
                  <div className="inventoryCard inventoryCardWarning">
                    <p>Low Stock (≤ {inventoryHealth.lowStockThreshold})</p>
                    <h3>{inventoryHealth.lowStockCount}</h3>
                  </div>
                  <div className="inventoryCard inventoryCardDanger">
                    <p>Out of Stock</p>
                    <h3>{inventoryHealth.outOfStockCount}</h3>
                  </div>
                </div>

                <div className="inventorySections">
                  <div className="inventorySection">
                    <h3>Low Stock Products</h3>
                    <div className="adminTableWrapper">
                      <table className="adminTable">
                        <thead>
                          <tr>
                            <th>Product ID</th>
                            <th>Name</th>
                            <th>Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryHealth.lowStockItems.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="adminEmpty">No low stock products.</td>
                            </tr>
                          ) : (
                            inventoryHealth.lowStockItems.map((item) => (
                              <tr key={`low-${item.productID}`}>
                                <td>{item.productID}</td>
                                <td>{item.productName}</td>
                                <td>{item.stockQuantity}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="inventorySection">
                    <h3>Top Selling Products</h3>
                    <div className="adminTableWrapper">
                      <table className="adminTable">
                        <thead>
                          <tr>
                            <th>Product ID</th>
                            <th>Name</th>
                            <th>Sold Qty</th>
                            <th>Current Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryHealth.topSellingItems.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="adminEmpty">No sales data yet.</td>
                            </tr>
                          ) : (
                            inventoryHealth.topSellingItems.map((item) => (
                              <tr key={`top-${item.productID}`}>
                                <td>{item.productID}</td>
                                <td>{item.productName}</td>
                                <td>{item.soldQty ?? 0}</td>
                                <td>{item.stockQuantity}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : activeTab === "comments" ? (
          <>
            <div className="ratingAnalyticsPanel">
              <div className="ratingAnalyticsHeader">
                <h3>Rating Analysis</h3>
                <button
                  type="button"
                  className="pageButton"
                  onClick={() => void fetchRatingAnalytics()}
                  disabled={loadingRatingAnalytics}
                >
                  {loadingRatingAnalytics ? "Refreshing..." : "Refresh Analysis"}
                </button>
              </div>

              {loadingRatingAnalytics ? <p className="adminStatus">Loading rating analytics...</p> : null}
              {ratingAnalyticsError ? (
                <p className="adminStatus adminStatusError">{ratingAnalyticsError}</p>
              ) : null}

              {!loadingRatingAnalytics && !ratingAnalyticsError && ratingAnalytics ? (
                <>
                  <div className="ratingSummaryCards">
                    <div className="overviewCard">
                      <p>Total Reviews</p>
                      <h3>{ratingAnalytics.totalReviews}</h3>
                      <span>Matching current filters</span>
                    </div>
                    <div className="overviewCard overviewCardRevenue">
                      <p>Average Rating</p>
                      <h3>{ratingAnalytics.averageRating.toFixed(2)} / 5</h3>
                      <span>Across all loaded review pages</span>
                    </div>
                    <div className="overviewCard overviewCardWarning">
                      <p>Low Ratings (1-2)</p>
                      <h3>{ratingAnalytics.lowRatingCount}</h3>
                      <span>
                        {ratingAnalytics.totalReviews > 0
                          ? `${((ratingAnalytics.lowRatingCount / ratingAnalytics.totalReviews) * 100).toFixed(1)}%`
                          : "0.0%"}
                      </span>
                    </div>
                    <div className="overviewCard">
                      <p>Positive Ratings (4-5)</p>
                      <h3>{ratingAnalytics.highRatingCount}</h3>
                      <span>
                        {ratingAnalytics.totalReviews > 0
                          ? `${((ratingAnalytics.highRatingCount / ratingAnalytics.totalReviews) * 100).toFixed(1)}%`
                          : "0.0%"}
                      </span>
                    </div>
                  </div>

                  <div className="ratingAnalyticsGrid">
                    <section className="overviewSection">
                      <h3>Rating Distribution</h3>
                      <div className="ratingBars">
                        {ratingDistributionRows.map((item) => (
                          <div key={`rating-${item.rating}`} className="ratingBarRow">
                            <label>{item.rating} star</label>
                            <div className="ratingBarTrack">
                              <div className="ratingBarFill" style={{ width: `${item.percentage}%` }} />
                            </div>
                            <span>
                              {item.count} ({item.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="overviewSection">
                      <h3>Top Rated Products</h3>
                      <div className="adminTableWrapper">
                        <table className="adminTable compactTable">
                          <thead>
                            <tr>
                              <th>Product ID</th>
                              <th>Avg Rating</th>
                              <th>Reviews</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topRatedProducts.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="adminEmpty">No data yet.</td>
                              </tr>
                            ) : (
                              topRatedProducts.map((item) => (
                                <tr key={`top-rated-${item.productID}`}>
                                  <td>{item.productID}</td>
                                  <td>{item.averageRating.toFixed(2)}</td>
                                  <td>{item.reviewCount}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="overviewSection">
                      <h3>Lowest Rated Products</h3>
                      <div className="adminTableWrapper">
                        <table className="adminTable compactTable">
                          <thead>
                            <tr>
                              <th>Product ID</th>
                              <th>Avg Rating</th>
                              <th>Low (1-2)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lowestRatedProducts.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="adminEmpty">No data yet.</td>
                              </tr>
                            ) : (
                              lowestRatedProducts.map((item) => (
                                <tr key={`low-rated-${item.productID}`}>
                                  <td>{item.productID}</td>
                                  <td>{item.averageRating.toFixed(2)}</td>
                                  <td>{item.lowRatingCount}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                </>
              ) : null}
            </div>

            <form className="productSearchRow" onSubmit={handleReviewFilterSubmit}>
              <input
                type="text"
                value={reviewSearchInput}
                onChange={(event) => setReviewSearchInput(event.target.value)}
                placeholder="Search by product ID, author, or comment"
                className="productInput"
              />
              <button type="submit" className="pageButton">
                Search
              </button>
              <button
                type="button"
                className="pageButton"
                onClick={() => {
                  setReviewSearchInput("");
                  setReviewSearchTerm("");
                  setReviewPage(0);
                  void Promise.all([
                    fetchReviews(0, { searchTerm: "" }),
                    fetchRatingAnalytics({ searchTerm: "" }),
                  ]);
                }}
              >
                Reset
              </button>
            </form>

            {editingReview ? (
              <div className="productForm">
                <h3>
                  Edit Comment: {editingReview.productID} / {editingReview.reviewID}
                </h3>
                <div className="productGrid">
                  <input className="productInput" value={editingReview.author || "-"} disabled />
                  <input className="productInput" value={editingReview.productID} disabled />
                  <input
                    className="productInput"
                    type="number"
                    min={1}
                    max={5}
                    value={reviewEditRating}
                    onChange={(event) => setReviewEditRating(clamp(Number(event.target.value) || 5, 1, 5))}
                  />
                </div>
                <textarea
                  className="productInput reviewEditTextarea"
                  rows={5}
                  value={reviewEditComment}
                  onChange={(event) => setReviewEditComment(event.target.value)}
                />
                <div className="productFormActions">
                  <button
                    type="button"
                    className="adminActionButton"
                    disabled={
                      reviewProcessingKey === `${editingReview.productID}:${editingReview.reviewID}`
                    }
                    onClick={() => void handleAdminUpdateReview()}
                  >
                    Save Comment
                  </button>
                  <button type="button" className="pageButton" onClick={cancelEditReview}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {loadingReviews ? <p className="adminStatus">Loading comments...</p> : null}
            {reviewError ? <p className="adminStatus adminStatusError">{reviewError}</p> : null}

            {!loadingReviews && !reviewError ? (
              <>
                <div className="adminTableWrapper">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>Product ID</th>
                        <th>Author</th>
                        <th>Rating</th>
                        <th>Comment</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="adminEmpty">
                            No comments found.
                          </td>
                        </tr>
                      ) : (
                        reviews.map((review) => {
                          const reviewKey = `${review.productID}:${review.reviewID}`;
                          const isProcessing = reviewProcessingKey === reviewKey;
                          return (
                            <tr key={reviewKey}>
                              <td>{review.productID}</td>
                              <td>{review.author || "-"}</td>
                              <td>{review.rating}</td>
                              <td className="commentCell">{review.comment}</td>
                              <td>{formatDateTime(review.createdAt)}</td>
                              <td>
                                <div className="rowActions">
                                  <button
                                    className="adminActionButton"
                                    disabled={isProcessing}
                                    onClick={() => startEditReview(review)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="dangerButton"
                                    disabled={isProcessing}
                                    onClick={() => void handleAdminDeleteReview(review)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="adminPagination">
                  <button
                    className="pageButton"
                    disabled={reviewPage <= 0}
                    onClick={() => void fetchReviews(reviewPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {reviewPage + 1} / {reviewTotalPages}
                  </span>
                  <button
                    className="pageButton"
                    disabled={reviewPage + 1 >= reviewTotalPages}
                    onClick={() => void fetchReviews(reviewPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : null}
          </>
        ) : activeTab === "products" ? (
          <>
            <form className="productSearchRow" onSubmit={handleProductSearch}>
              <input
                type="text"
                value={productSearchInput}
                onChange={(event) => setProductSearchInput(event.target.value)}
                placeholder="Search by product ID or name"
                className="productInput"
              />
              <button type="submit" className="pageButton">
                Search
              </button>
              <button
                type="button"
                className="pageButton"
                onClick={() => {
                  setProductSearchInput("");
                  setProductSearchTerm("");
                  fetchProducts("");
                }}
              >
                Reset
              </button>
            </form>

            <form className="productForm" onSubmit={handleSaveProduct}>
              <h3>{editingProductId ? `Edit Product: ${editingProductId}` : "Add New Product"}</h3>
              <div className="productGrid">
                <input
                  className="productInput"
                  placeholder="Product ID"
                  value={productForm.productID}
                  disabled={editingProductId !== null}
                  onChange={(event) => onProductInputChange("productID", event.target.value)}
                />
                <input
                  className="productInput"
                  placeholder="Product Name"
                  value={productForm.productName}
                  onChange={(event) => onProductInputChange("productName", event.target.value)}
                />
                <input
                  className="productInput"
                  placeholder="Front Image URL"
                  value={productForm.frontImg}
                  onChange={(event) => onProductInputChange("frontImg", event.target.value)}
                />
                <div className="uploadField">
                  <label className="uploadLabel">Upload Front Image</label>
                  <input
                    className="productInput"
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageUpload("frontImg", event)}
                  />
                  <span className="uploadHint">{uploadingFront ? "Uploading..." : "Supports JPG, PNG, WEBP..."}</span>
                </div>
                <input
                  className="productInput"
                  placeholder="Back Image URL"
                  value={productForm.backImg}
                  onChange={(event) => onProductInputChange("backImg", event.target.value)}
                />
                <div className="uploadField">
                  <label className="uploadLabel">Upload Back Image</label>
                  <input
                    className="productInput"
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageUpload("backImg", event)}
                  />
                  <span className="uploadHint">{uploadingBack ? "Uploading..." : "Supports JPG, PNG, WEBP..."}</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="productInput"
                  placeholder="Price"
                  value={productForm.productPrice}
                  onChange={(event) => onProductInputChange("productPrice", event.target.value)}
                />
                <input
                  className="productInput"
                  placeholder="Reviews"
                  value={productForm.productReviews}
                  onChange={(event) => onProductInputChange("productReviews", event.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  className="productInput"
                  placeholder="Stock Quantity"
                  value={productForm.stockQuantity}
                  onChange={(event) => onProductInputChange("stockQuantity", event.target.value)}
                />
                <label className="productToggle">
                  <input
                    type="checkbox"
                    checked={productForm.active}
                    onChange={(event) =>
                      setProductForm((prev) => ({ ...prev, active: event.target.checked }))
                    }
                  />
                  <span>Product Active</span>
                </label>
              </div>
              <div className="imagePreviewRow">
                <div className="imagePreviewCard">
                  <p>Front Preview</p>
                  {productForm.frontImg ? (
                    <img src={productForm.frontImg} alt="Front preview" />
                  ) : (
                    <span>No image</span>
                  )}
                </div>
                <div className="imagePreviewCard">
                  <p>Back Preview</p>
                  {productForm.backImg ? (
                    <img src={productForm.backImg} alt="Back preview" />
                  ) : (
                    <span>No image</span>
                  )}
                </div>
              </div>
              <div className="productFormActions">
                <button type="submit" className="adminActionButton" disabled={isSavingProduct}>
                  {isSavingProduct ? "Saving..." : editingProductId ? "Update Product" : "Create Product"}
                </button>
                <button type="button" className="pageButton" onClick={resetProductForm}>
                  Clear
                </button>
              </div>
            </form>

            {loadingProducts ? <p className="adminStatus">Loading products...</p> : null}
            {productError ? <p className="adminStatus adminStatusError">{productError}</p> : null}

            {!loadingProducts && !productError ? (
              <div className="adminTableWrapper">
                <table className="adminTable">
                  <thead>
                    <tr>
                      <th>Product ID</th>
                      <th>Name</th>
                      <th>Price</th>
                      <th>Reviews</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="adminEmpty">
                          No products found.
                        </td>
                      </tr>
                    ) : (
                      products.map((product) => {
                        const isProcessing = productProcessingId === product.productID;
                        return (
                          <tr key={product.productID}>
                            <td>{product.productID}</td>
                            <td>{product.productName}</td>
                            <td>${product.productPrice}</td>
                            <td>{product.productReviews || "-"}</td>
                            <td>{product.stockQuantity}</td>
                            <td>
                              <span className={product.active ? "statusActive" : "statusInactive"}>
                                {product.active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>
                              <div className="rowActions">
                                <button
                                  className="adminActionButton"
                                  onClick={() => handleEditProduct(product)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="dangerButton"
                                  disabled={isProcessing}
                                  onClick={() => handleDeleteProduct(product.productID)}
                                >
                                  {isProcessing ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : activeTab === "audit" ? (
          <>
            <form className="auditFilterRow" onSubmit={handleAuditFilterSubmit}>
              <input
                type="text"
                className="productInput"
                placeholder="Event type (e.g. ORDER_CREATED)"
                value={auditEventTypeFilter}
                onChange={(e) => setAuditEventTypeFilter(e.target.value)}
              />
              <input
                type="text"
                className="productInput"
                placeholder="Entity type (e.g. ORDER)"
                value={auditEntityTypeFilter}
                onChange={(e) => setAuditEntityTypeFilter(e.target.value)}
              />
              <input type="date" className="productInput" value={auditDateFrom} onChange={(e) => setAuditDateFrom(e.target.value)} />
              <input type="date" className="productInput" value={auditDateTo} onChange={(e) => setAuditDateTo(e.target.value)} />
              <button type="submit" className="pageButton">Filter</button>
              <button type="button" className="pageButton" onClick={() => void handleAuditFilterReset()}>Reset</button>
            </form>

            {loadingAudit ? <p className="adminStatus">Loading audit events...</p> : null}
            {auditError ? <p className="adminStatus adminStatusError">{auditError}</p> : null}

            {!loadingAudit && !auditError ? (
              <>
                <div className="adminTableWrapper">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Event Type</th>
                        <th>Entity</th>
                        <th>Entity ID</th>
                        <th>Actor</th>
                        <th>Details</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditEvents.length === 0 ? (
                        <tr><td colSpan={7} className="adminEmpty">No audit events found.</td></tr>
                      ) : (
                        auditEvents.map((event) => (
                          <tr key={event.id}>
                            <td>{event.id}</td>
                            <td><span className="statusPill">{event.event_type}</span></td>
                            <td>{event.entity_type}</td>
                            <td>{event.entity_id}</td>
                            <td>{event.actor || "-"}</td>
                            <td className="auditDetailCell">{JSON.stringify(event.details, null, 2)}</td>
                            <td>{formatDateTime(event.created_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="adminPagination">
                  <button className="pageButton" disabled={auditPage <= 0} onClick={() => void fetchAuditEvents(auditPage - 1)}>Previous</button>
                  <span>Page {auditPage + 1} / {auditTotalPages}</span>
                  <button className="pageButton" disabled={auditPage + 1 >= auditTotalPages} onClick={() => void fetchAuditEvents(auditPage + 1)}>Next</button>
                </div>
              </>
            ) : null}
          </>
        ) : activeTab === "queues" ? (
          <>
            {loadingQueues ? <p className="adminStatus">Loading queue data...</p> : null}
            {queueError ? <p className="adminStatus adminStatusError">{queueError}</p> : null}

            {!loadingQueues && !queueError && queueData ? (
              <>
                <div className="queueSummaryCards">
                  <div className="queueCard">
                    <p>Total Queues</p>
                    <h3>{queueData.summary.totalQueues}</h3>
                  </div>
                  <div className={`queueCard ${queueData.summary.totalMessages > 0 ? "queueCardWarn" : "queueCardOk"}`}>
                    <p>Total Messages</p>
                    <h3>{queueData.summary.totalMessages}</h3>
                  </div>
                  <div className="queueCard">
                    <p>Active Consumers</p>
                    <h3>{queueData.summary.totalConsumers}</h3>
                  </div>
                  <div className={`queueCard ${queueData.summary.totalDlqMessages > 0 ? "queueCardDanger" : "queueCardOk"}`}>
                    <p>DLQ Messages</p>
                    <h3>{queueData.summary.totalDlqMessages}</h3>
                  </div>
                </div>

                <div className="queueSectionsRow">
                  <div className="overviewSection">
                    <h3>Main Queues</h3>
                    <div className="adminTableWrapper">
                      <table className="adminTable compactTable">
                        <thead><tr><th>Queue Name</th><th>Messages</th><th>Ready</th><th>Unacked</th><th>Consumers</th><th>State</th></tr></thead>
                        <tbody>
                          {queueData.queues.length === 0 ? (
                            <tr><td colSpan={6} className="adminEmpty">No queues found.</td></tr>
                          ) : (
                            queueData.queues.map((q) => (
                              <tr key={q.name}>
                                <td>{q.name}</td>
                                <td>{q.messages}</td>
                                <td>{q.messagesReady}</td>
                                <td>{q.messagesUnacked}</td>
                                <td>{q.consumers}</td>
                                <td><span className={`queueStateBadge queueStateBadge-${q.state}`}>{q.state}</span></td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {queueData.retryQueues.length > 0 ? (
                    <div className="overviewSection">
                      <h3>Retry Queues</h3>
                      <div className="adminTableWrapper">
                        <table className="adminTable compactTable">
                          <thead><tr><th>Queue Name</th><th>Messages</th><th>State</th></tr></thead>
                          <tbody>
                            {queueData.retryQueues.map((q) => (
                              <tr key={q.name}>
                                <td>{q.name}</td>
                                <td>{q.messages}</td>
                                <td><span className={`queueStateBadge queueStateBadge-${q.state}`}>{q.state}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {queueData.dlqQueues.length > 0 ? (
                    <div className="overviewSection">
                      <h3>Dead Letter Queues (DLQ)</h3>
                      <div className="adminTableWrapper">
                        <table className="adminTable compactTable">
                          <thead><tr><th>Queue Name</th><th>Messages</th><th>State</th></tr></thead>
                          <tbody>
                            {queueData.dlqQueues.map((q) => (
                              <tr key={q.name}>
                                <td>{q.name}</td>
                                <td>{q.messages}</td>
                                <td><span className={`queueStateBadge queueStateBadge-${q.state}`}>{q.state}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {!loadingQueues && !queueError && !queueData ? (
              <p className="adminStatus">No queue data available. RabbitMQ may be offline.</p>
            ) : null}
          </>
        ) : activeTab === "export" ? (
          <>
            <div className="exportGrid">
              <div className="exportCard">
                <div className="exportCardIcon">📦</div>
                <h4>Export Orders</h4>
                <p>Download all orders as CSV with customer info, amounts, and statuses</p>
                <button className="exportButton" disabled={exportingKey !== null} onClick={() => void handleExportOrders()}>
                  {exportingKey === "orders" ? "Exporting..." : "Download Orders CSV"}
                </button>
              </div>
              <div className="exportCard">
                <div className="exportCardIcon">👥</div>
                <h4>Export Users</h4>
                <p>Download all user accounts with email, name, and status</p>
                <button className="exportButton" disabled={exportingKey !== null} onClick={() => void handleExportUsers()}>
                  {exportingKey === "users" ? "Exporting..." : "Download Users CSV"}
                </button>
              </div>
              <div className="exportCard">
                <div className="exportCardIcon">🛍️</div>
                <h4>Export Products</h4>
                <p>Download product catalog with prices, stock, and active status</p>
                <button className="exportButton" disabled={exportingKey !== null} onClick={() => void handleExportProducts()}>
                  {exportingKey === "products" ? "Exporting..." : "Download Products CSV"}
                </button>
              </div>
              <div className="exportCard">
                <div className="exportCardIcon">⭐</div>
                <h4>Export Reviews</h4>
                <p>Download all product reviews with ratings and comments</p>
                <button className="exportButton" disabled={exportingKey !== null} onClick={() => void handleExportReviews()}>
                  {exportingKey === "reviews" ? "Exporting..." : "Download Reviews CSV"}
                </button>
              </div>
            </div>
            {exportStatus ? <p className="exportStatus">{exportStatus}</p> : null}
          </>
        ) : activeTab === "health" ? (
          <>
            {loadingHealth ? <p className="adminStatus">Loading system health...</p> : null}
            {healthError ? <p className="adminStatus adminStatusError">{healthError}</p> : null}

            {!loadingHealth && !healthError && healthData ? (
              <>
                <div className="healthGrid">
                  <div className="healthCard">
                    <p>Database</p>
                    <h3>
                      <span className={`healthDot ${healthData.database.status === "connected" ? "healthDotGreen" : "healthDotRed"}`} />
                      {healthData.database.status === "connected" ? "Connected" : "Error"}
                    </h3>
                    <span>Latency: {healthData.database.latencyMs}ms</span>
                  </div>
                  <div className="healthCard">
                    <p>Uptime</p>
                    <h3>{healthData.process.uptimeFormatted}</h3>
                    <span>PID: {healthData.process.pid}</span>
                  </div>
                  <div className="healthCard">
                    <p>Heap Memory</p>
                    <h3>{healthData.memory.heapUsedMB} MB</h3>
                    <span>of {healthData.memory.heapTotalMB} MB total</span>
                  </div>
                  <div className="healthCard">
                    <p>RSS Memory</p>
                    <h3>{healthData.memory.rssMB} MB</h3>
                    <span>Resident set size</span>
                  </div>
                  <div className="healthCard">
                    <p>API Response</p>
                    <h3>{healthData.responseTimeMs}ms</h3>
                    <span>Health check round-trip</span>
                  </div>
                  <div className="healthCard">
                    <p>Node.js</p>
                    <h3>{healthData.process.nodeVersion}</h3>
                    <span>{healthData.process.platform}</span>
                  </div>
                </div>

                <div className="healthSections">
                  <div className="healthSection">
                    <h3>Process Details</h3>
                    <div className="healthDetailList">
                      <div className="healthDetailItem"><label>Node Version</label><span>{healthData.process.nodeVersion}</span></div>
                      <div className="healthDetailItem"><label>Platform</label><span>{healthData.process.platform}</span></div>
                      <div className="healthDetailItem"><label>PID</label><span>{healthData.process.pid}</span></div>
                      <div className="healthDetailItem"><label>Uptime (seconds)</label><span>{healthData.process.uptimeSeconds.toLocaleString()}</span></div>
                    </div>
                  </div>
                  <div className="healthSection">
                    <h3>Environment</h3>
                    <div className="healthDetailList">
                      <div className="healthDetailItem"><label>NODE_ENV</label><span>{healthData.environment.nodeEnv}</span></div>
                      <div className="healthDetailItem"><label>DB Client</label><span>{healthData.environment.dbClient}</span></div>
                      <div className="healthDetailItem"><label>DB Host</label><span>{healthData.environment.dbHost}</span></div>
                      <div className="healthDetailItem"><label>External Memory</label><span>{healthData.memory.externalMB} MB</span></div>
                      <div className="healthDetailItem"><label>DB Latency</label><span>{healthData.database.latencyMs}ms</span></div>
                      {healthData.database.error ? (
                        <div className="healthDetailItem"><label>DB Error</label><span style={{ color: "#b42318" }}>{healthData.database.error}</span></div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : activeTab === "notes" ? (
          <>
            <div className="noteForm">
              <h3>{editingNoteId ? `Edit Note #${editingNoteId}` : "Create Note"}</h3>
              <div className="noteFormFields">
                <input
                  className="productInput"
                  placeholder="Note title"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                />
                <textarea
                  className="noteTextarea"
                  placeholder="Note content..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={4}
                />
                <div className="noteFormRow">
                  <label className="productToggle">
                    <input type="checkbox" checked={notePinned} onChange={(e) => setNotePinned(e.target.checked)} />
                    <span>Pin this note</span>
                  </label>
                  <button type="button" className="adminActionButton" disabled={savingNote} onClick={() => void handleSaveNote()}>
                    {savingNote ? "Saving..." : editingNoteId ? "Update Note" : "Create Note"}
                  </button>
                  {editingNoteId ? (
                    <button type="button" className="pageButton" onClick={resetNoteForm}>Cancel</button>
                  ) : null}
                </div>
              </div>
            </div>

            {loadingNotes ? <p className="adminStatus">Loading notes...</p> : null}
            {noteError ? <p className="adminStatus adminStatusError">{noteError}</p> : null}

            {!loadingNotes && !noteError ? (
              <div className="noteCards">
                {notes.length === 0 ? (
                  <p className="adminStatus">No notes yet. Create your first note above!</p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className={`noteCard ${note.is_pinned ? "noteCardPinned" : ""}`}>
                      <div className="noteCardHeader">
                        <h4>{note.title || "(Untitled)"}</h4>
                        {note.is_pinned ? <span className="pinBadge">📌 Pinned</span> : null}
                      </div>
                      {note.content ? <div className="noteCardContent">{note.content}</div> : null}
                      <div className="noteCardMeta">
                        Created: {formatDateTime(note.created_at)} · Updated: {formatDateTime(note.updated_at)}
                      </div>
                      <div className="noteCardActions">
                        <button className="pageButton" onClick={() => handleEditNote(note)}>Edit</button>
                        <button className="pageButton" onClick={() => void handleTogglePin(note)}>
                          {note.is_pinned ? "Unpin" : "Pin"}
                        </button>
                        <button className="dangerButton" onClick={() => void handleDeleteNote(note.id)}>Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </>
        ) : activeTab === "settings" ? (
          <>
            {loadingSettings ? <p className="adminStatus">Loading settings...</p> : null}
            {settingsError ? <p className="adminStatus adminStatusError">{settingsError}</p> : null}

            {!loadingSettings && !settingsError ? (
              <div className="settingsContainer">
                <div className="settingsList">
                  {settings.length === 0 ? (
                    <p className="adminStatus">No settings found. Run the migration script to seed default settings.</p>
                  ) : (
                    settings.map((setting) => (
                      <div key={setting.setting_key} className="settingsRow">
                        <div>
                          <div className="settingsKey">{setting.setting_key}</div>
                          <div className="settingsDesc">{setting.description}</div>
                        </div>
                        <input
                          className="settingsInput"
                          value={settingsEditValues[setting.setting_key] ?? setting.setting_value}
                          onChange={(e) => setSettingsEditValues((prev) => ({ ...prev, [setting.setting_key]: e.target.value }))}
                        />
                        <button
                          className="settingsSaveBtn"
                          disabled={savingSettingKey === setting.setting_key || settingsEditValues[setting.setting_key] === setting.setting_value}
                          onClick={() => void handleSaveSetting(setting.setting_key)}
                        >
                          {savingSettingKey === setting.setting_key ? "Saving..." : "Save"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
