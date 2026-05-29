"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {getUser, subscribeToAuthChanges } from "@/lib/auth";
import toast from "react-hot-toast";
import "./admin.css";

type AdminUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  active: boolean;
  role?: string;
  roles?: string[];
};

type AccessRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  businessName?: string | null;
  websiteUrl?: string | null;
  contactPhone?: string | null;
  note?: string | null;
  reviewerNote?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
  requestedByUserId?: string | null;
  requestedByEmail?: string | null;
};

type ProductChangeRequest = {
  id: string;
  actionType: "CREATE" | "UPDATE" | "DELETE" | "BULK_UPSERT";
  targetProductId?: string | null;
  requestPayload?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedByUserId?: string | null;
  requestedByEmail?: string | null;
  reviewedByUserId?: string | null;
  reviewedByEmail?: string | null;
  reviewerNote?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
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
  category: string;
  sizes: string[];
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

type ShipperIncident = {
  id: number;
  order_id: number;
  order_number: string;
  customer_email: string;
  incident_type: "DELIVERY_DELAY" | "QUALITY_COMPLAINT" | "DAMAGED_PACKAGE" | "FAILED_ATTEMPT" | "OTHER";
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "RESOLVED";
  details: string | null;
  created_by: string;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
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
  reservedInCarts?: number;
  availableToSell?: number;
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
  databaseContext?: {
    source: string;
    totalOrders: number;
    pendingOrders: number;
    lowStockProducts: number;
    totalAuditEvents: number;
    latestAuditEventAt: string | null;
  } | null;
  unavailable?: boolean;
  details?: string;
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

type AdminAttendanceRecord = {
  shiftId: string;
  shiftDate: string;
  employee: {
    email: string;
    name: string;
    role: string;
    userId: string;
  };
  clockInAt: number;
  clockOutAt: number | null;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  status: "CLOCKED_OUT" | "CLOCKED_IN" | "ON_BREAK";
  note: string | null;
  warningCount: number;
  reprimandCount: number;
  openIssueCount: number;
};

type AdminAttendancePolicy = {
  monitorEnabled: boolean;
  longBreakMinutes: number;
  breakReminderIntervalMinutes: number;
  minDailyWorkMinutes: number;
  lowHoursReminderAfterLocalHour: number;
};

type AdminPerformanceReview = {
  reviewId: string;
  employeeUserId: string;
  employeeEmail: string;
  employeeName: string;
  reviewType: "WARNING" | "REPRIMAND" | "NEGATIVE_REVIEW";
  category: string;
  title: string;
  summary: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  relatedShiftId: string | null;
  lastNotifiedAt: number | null;
  notificationCount: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

type AdminAttendanceSnapshot = {
  timezone: string;
  generatedAt: number;
  policy: AdminAttendancePolicy;
  summary: {
    employeesTracked: number;
    activeEmployees: number;
    employeesOnBreak: number;
    todayWorkedMinutes: number;
    weekWorkedMinutes: number;
  };
  performanceSummary: {
    totalReviews: number;
    openReviews: number;
    warningCount: number;
    reprimandCount: number;
  };
  activeShifts: AdminAttendanceRecord[];
  records: AdminAttendanceRecord[];
  performanceReviews: AdminPerformanceReview[];
};

type AdminAttendanceStatusFilter = "all" | "active" | "on_break" | "closed";
type AdminPerformanceReviewStatusFilter = "all" | "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

type AdminTab =
  | "overview"
  | "requests"
  | "users"
  | "orders"
  | "inventory"
  | "products"
  | "comments"
  | "attendance"
  | "audit"
  | "queues"
  | "export"
  | "health"
  | "notes"
  | "settings";

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

type ProductRequestPayload = {
  productID?: string;
  productName?: string;
  productPrice?: number;
  stockQuantity?: number;
  sizes?: string[];
  active?: boolean;
};

const ORDER_STATUS_OPTIONS = ["pending", "processing", "paid", "shipped", "completed", "cancelled"];
const PAYMENT_STATUS_OPTIONS = ["pending", "authorized", "paid", "failed", "refunded"];
const HOME_BANNER_SETTINGS = [
  {
    key: "banner_left_url",
    label: "Main Banner Left",
    defaultValue: "/Banner/banner_1.jpg",
    description: "URL for the left hero banner panel on the home page."},
  {
    key: "banner_right_url",
    label: "Main Banner Right",
    defaultValue: "/Banner/banner_2.jpg",
    description: "URL for the right hero banner panel on the home page."},
  {
    key: "collection_left_url",
    label: "Collection Left",
    defaultValue: "/Collection/collection1.jpg",
    description: "URL for the left image in the collection section."},
  {
    key: "collection_top_url",
    label: "Collection Top Right",
    defaultValue: "/Collection/collection2.jpg",
    description: "URL for the top-right image in the collection section."},
  {
    key: "collection_bottom_left_url",
    label: "Collection Bottom Left",
    defaultValue: "/Collection/collection3.jpg",
    description: "URL for the bottom-left image in the collection section."},
  {
    key: "deal_background_url",
    label: "Deal Background",
    defaultValue: "/Deal/dealbg.jpg",
    description: "URL for the Deal of the Week section background image."},
  {
    key: "hero_background_url",
    label: "3D Hero Background",
    defaultValue: "/slideshow-pattern.png",
    description: "URL for the 3D hero section background image."},
] as const;
const HOME_BANNER_SETTING_KEY_SET = new Set<string>(HOME_BANNER_SETTINGS.map((item) => item.key));
const CLOTHING_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const INITIAL_PRODUCT_FORM: Product = {
  productID: "",
  frontImg: "",
  backImg: "",
  productName: "",
  productPrice: 0,
  productReviews: "",
  category: "",
  sizes: ["S", "M", "L"],
  stockQuantity: 25,
  active: true};

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
    lowestRatedProducts: []},
  revenueByDay: [],
  ordersByStatus: [],
  recentOrders: []};

const INITIAL_ATTENDANCE: AdminAttendanceSnapshot = {
  timezone: "UTC",
  generatedAt: 0,
  policy: {
    monitorEnabled: false,
    longBreakMinutes: 30,
    breakReminderIntervalMinutes: 30,
    minDailyWorkMinutes: 480,
    lowHoursReminderAfterLocalHour: 16},
  summary: {
    employeesTracked: 0,
    activeEmployees: 0,
    employeesOnBreak: 0,
    todayWorkedMinutes: 0,
    weekWorkedMinutes: 0},
  performanceSummary: {
    totalReviews: 0,
    openReviews: 0,
    warningCount: 0,
    reprimandCount: 0},
  activeShifts: [],
  records: [],
  performanceReviews: []};

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

function formatRelativeTime(value: string | number | null | undefined): string {
  if (value == null || value === "") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];

  for (const [unit, size] of units) {
    if (Math.abs(diffMs) >= size || unit === "minute") {
      return formatter.format(Math.round(diffMs / size), unit);
    }
  }

  return "just now";
}

function formatMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${hours}h ${minutes}m`;
}

function formatTimestamp(value: number | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatCurrency(value: number, currency = "USD"): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2}).format(Number.isFinite(amount) ? amount : 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeAuditDetails(details: Record<string, unknown> | null | undefined): string {
  if (!details || typeof details !== "object") return "No additional metadata";

  const preferredKeys = [
    "message",
    "reason",
    "summary",
    "status",
    "orderStatus",
    "paymentStatus",
    "productID",
    "quantity",
    "email",
  ];

  const pairs = preferredKeys
    .map((key) => [key, details[key]] as const)
    .filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (pairs.length > 0) {
    return pairs
      .slice(0, 3)
      .map(([key, value]) => `${formatLabel(key)}: ${String(value)}`)
      .join(" • ");
  }

  const fallback = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 3)
    .map(([key, value]) => `${formatLabel(key)}: ${String(value)}`);

  return fallback.length > 0 ? fallback.join(" • ") : "Structured metadata available";
}

function resolveAdminUserRole(
  user: { role?: string; roles?: string[] }
): "user" | "employee" | "supplier" | "admin" | "shipper" | "seller" {
  if ((user.role || "").toLowerCase() === "admin") return "admin";
  if ((user.role || "").toLowerCase() === "employee") return "employee";
  if ((user.role || "").toLowerCase() === "supplier") return "supplier";
  if ((user.role || "").toLowerCase() === "shipper") return "shipper";
  if ((user.role || "").toLowerCase() === "seller") return "seller";
  if (Array.isArray(user.roles) && user.roles.some((role) => role.toUpperCase() === "ROLE_ADMIN")) return "admin";
  if (Array.isArray(user.roles) && user.roles.some((role) => role.toUpperCase() === "ROLE_EMPLOYEE")) return "employee";
  if (Array.isArray(user.roles) && user.roles.some((role) => role.toUpperCase() === "ROLE_SUPPLIER")) return "supplier";
  if (Array.isArray(user.roles) && user.roles.some((role) => role.toUpperCase() === "ROLE_SHIPPER")) return "shipper";
  if (Array.isArray(user.roles) && user.roles.some((role) => role.toUpperCase() === "ROLE_SELLER")) return "seller";
  return "user";
}

function parseProductRequestPayload(request: ProductChangeRequest): ProductRequestPayload | null {
  if (!request.requestPayload) return null;

  try {
    const parsed = JSON.parse(request.requestPayload) as ProductRequestPayload | ProductRequestPayload[];
    if (Array.isArray(parsed)) {
      return parsed[0] ?? null;
    }
    return parsed;
  } catch {
    return null;
  }
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
      lowRatingCount: value.low}))
    .sort((a, b) => b.reviewCount - a.reviewCount || b.averageRating - a.averageRating);

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;

  return {
    totalReviews,
    averageRating,
    lowRatingCount,
    highRatingCount,
    distribution,
    productStats};
}

export default function AdminPage() {
  const router = useRouter();
  const token = getUser();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [dashboard, setDashboard] = useState<DashboardSummary>(INITIAL_DASHBOARD);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardDays, setDashboardDays] = useState(7);
  const [dashboardRecentLimit, setDashboardRecentLimit] = useState(8);
  const [dashboardLowStockThreshold, setDashboardLowStockThreshold] = useState(5);
  const [fulfillmentInsights, setFulfillmentInsights] = useState<{
    readyToShip: number;
    shippedLast7Days: number;
    pendingCheckoutOrders: number;
  } | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userProcessingId, setUserProcessingId] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(0);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userError, setUserError] = useState<string | null>(null);
  const [productRequests, setProductRequests] = useState<ProductChangeRequest[]>([]);
  const [loadingProductRequests, setLoadingProductRequests] = useState(true);
  const [productRequestError, setProductRequestError] = useState<string | null>(null);
  const [productRequestProcessingId, setProductRequestProcessingId] = useState<string | null>(null);
  const [supplierRequests, setSupplierRequests] = useState<AccessRequest[]>([]);
  const [loadingSupplierRequests, setLoadingSupplierRequests] = useState(true);
  const [supplierRequestError, setSupplierRequestError] = useState<string | null>(null);
  const [supplierRequestProcessingId, setSupplierRequestProcessingId] = useState<string | null>(null);
  const [sellerRequests, setSellerRequests] = useState<AccessRequest[]>([]);
  const [loadingSellerRequests, setLoadingSellerRequests] = useState(true);
  const [sellerRequestError, setSellerRequestError] = useState<string | null>(null);
  const [sellerRequestProcessingId, setSellerRequestProcessingId] = useState<string | null>(null);

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
  const [shipperIncidents, setShipperIncidents] = useState<ShipperIncident[]>([]);
  const [loadingShipperIncidents, setLoadingShipperIncidents] = useState(false);
  const [shipperIncidentError, setShipperIncidentError] = useState<string | null>(null);
  const [incidentProcessingId, setIncidentProcessingId] = useState<number | null>(null);

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

  const [attendanceSnapshot, setAttendanceSnapshot] = useState<AdminAttendanceSnapshot>(INITIAL_ATTENDANCE);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceQueryInput, setAttendanceQueryInput] = useState("");
  const [attendanceQuery, setAttendanceQuery] = useState("");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<AdminAttendanceStatusFilter>("all");
  const [attendanceReviewStatusFilter, setAttendanceReviewStatusFilter] =
    useState<AdminPerformanceReviewStatusFilter>("all");
  const [attendanceDateFrom, setAttendanceDateFrom] = useState("");
  const [attendanceDateTo, setAttendanceDateTo] = useState("");
  const [attendanceReviewType, setAttendanceReviewType] =
    useState<AdminPerformanceReview["reviewType"]>("WARNING");
  const [attendanceReviewTitle, setAttendanceReviewTitle] = useState("");
  const [attendanceReviewSummary, setAttendanceReviewSummary] = useState("");
  const [attendanceReviewSendEmail, setAttendanceReviewSendEmail] = useState(true);
  const [selectedAttendanceEmployee, setSelectedAttendanceEmployee] = useState<{
    userId: string;
    email: string;
    name: string;
    shiftId: string | null;
  } | null>(null);
  const [attendanceReviewProcessingKey, setAttendanceReviewProcessingKey] = useState<string | null>(null);
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
  const [uploadingSettingKey, setUploadingSettingKey] = useState<string | null>(null);

  const [loadedTabs, setLoadedTabs] = useState<Record<AdminTab, boolean>>({
    overview: false,
    requests: false,
    users: false,
    orders: false,
    inventory: false,
    attendance: false,
    products: false,
    comments: false,
    audit: false,
    queues: false,
    export: false,
    health: false,
    notes: false,
    settings: false});
  const settingsByKey = useMemo(() => {
    return settings.reduce<Record<string, AdminSetting>>((acc, setting) => {
      acc[setting.setting_key] = setting;
      return acc;
    }, {});
  }, [settings]);
  const genericSettings = useMemo(
    () => settings.filter((setting) => !HOME_BANNER_SETTING_KEY_SET.has(setting.setting_key)),
    [settings]
  );
  const getSettingValue = useCallback(
    (key: string, fallbackValue = "") => settingsEditValues[key] ?? settingsByKey[key]?.setting_value ?? fallbackValue,
    [settingsByKey, settingsEditValues]
  );
  const inventoryInsights = useMemo(() => {
    if (!inventoryHealth) return null;

    const unsoldInStockItems = inventoryHealth.noSalesItems.filter((item) => (item.availableToSell ?? item.stockQuantity) > 0);
    const stockExposure = inventoryHealth.totalStock > 0
      ? Math.round((inventoryHealth.totalReservedInCarts / inventoryHealth.totalStock) * 100)
      : 0;

    const actions: string[] = [];
    if (inventoryHealth.outOfStockCount > 0) {
      actions.push(`${inventoryHealth.outOfStockCount} products are already unavailable for sale.`);
    }
    if (inventoryHealth.lowStockCount > 0) {
      actions.push(
        `${inventoryHealth.lowStockCount} products are at or below the low-stock threshold of ${inventoryHealth.lowStockThreshold}.`
      );
    }
    if (inventoryHealth.totalReservedInCarts > 0) {
      actions.push(
        `${inventoryHealth.totalReservedInCarts} units are tied up in carts, which can hide true sellable stock.`
      );
    }
    if (unsoldInStockItems.length > 0) {
      actions.push(
        `${unsoldInStockItems.length} active products have stock on hand but no recent sales signal.`
      );
    }
    if (actions.length === 0) {
      actions.push("No immediate stock risk detected. Use this panel to spot demand gaps before they become markdowns.");
    }

    return {
      stockExposure,
      actions,
      unsoldInStockItems: unsoldInStockItems.slice(0, 8),
      outOfStockItems: inventoryHealth.outOfStockItems.slice(0, 8)};
  }, [inventoryHealth]);
  const auditInsights = useMemo(() => {
    if (auditEvents.length === 0) {
      return {
        uniqueActors: 0,
        uniqueEntities: 0,
        mostCommonEvent: null as string | null,
        actorlessCount: 0};
    }

    const actorSet = new Set(auditEvents.map((event) => (event.actor || "").trim()).filter(Boolean));
    const entitySet = new Set(auditEvents.map((event) => (event.entity_type || "").trim()).filter(Boolean));
    const eventCounts = auditEvents.reduce<Record<string, number>>((acc, event) => {
      const key = event.event_type || "UNKNOWN";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const mostCommonEvent =
      Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      uniqueActors: actorSet.size,
      uniqueEntities: entitySet.size,
      mostCommonEvent,
      actorlessCount: auditEvents.filter((event) => !(event.actor || "").trim()).length};
  }, [auditEvents]);
  const queueInsights = useMemo(() => {
    if (!queueData) return null;

    const mainQueuesByBacklog = [...queueData.queues].sort(
      (a, b) => b.messages - a.messages || a.consumers - b.consumers
    );
    const stalledQueues = queueData.queues.filter((queue) => queue.messages > 0 && queue.consumers === 0);
    const busyQueues = mainQueuesByBacklog.filter((queue) => queue.messages > 0);
    const status =
      queueData.unavailable
        ? "unavailable"
        : queueData.summary.totalDlqMessages > 0 || stalledQueues.length > 0
          ? "critical"
          : queueData.summary.totalMessages > 0
            ? "attention"
            : "healthy";

    const actions: string[] = [];
    if (queueData.unavailable) {
      actions.push("RabbitMQ management API is unavailable, so broker health cannot be confirmed from this screen.");
    }
    if (queueData.summary.totalDlqMessages > 0) {
      actions.push(`${queueData.summary.totalDlqMessages} messages are stuck in dead-letter queues and need inspection or replay.`);
    }
    if (stalledQueues.length > 0) {
      actions.push(`${stalledQueues.length} queues have backlog but no active consumers.`);
    }
    if (!queueData.unavailable && queueData.summary.totalQueues === 0) {
      actions.push("No queues are visible. Either async processing is not configured yet or the broker is empty.");
    }
    if (actions.length === 0) {
      actions.push("No queue pressure detected. Keep watching for backlog growth, consumer drops, and DLQ drift.");
    }

    return {
      status,
      actions,
      stalledQueues,
      busyQueues: busyQueues.slice(0, 6),
      topQueues: mainQueuesByBacklog.slice(0, 8)};
  }, [queueData]);

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
        lowStockThreshold: String(safeLowStockThreshold)});
      const response = await fetch(`/api/auth/admin-dashboard?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"});

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
              adds: Number(item.adds ?? 0)}))
          : [],
        topWishlistedProducts: Array.isArray(payload?.topWishlistedProducts)
          ? payload.topWishlistedProducts.map((item) => ({
              productID: item.productID ?? "",
              productName: item.productName ?? "",
              wishlists: Number(item.wishlists ?? 0)}))
          : [],
        topSoldProducts: Array.isArray(payload?.topSoldProducts)
          ? payload.topSoldProducts.map((item) => ({
              productID: item.productID ?? "",
              productName: item.productName ?? "",
              soldQty: Number(item.soldQty ?? 0)}))
          : [],
        ratingAnalysis: {
          totalReviews: Number(payload?.ratingAnalysis?.totalReviews ?? 0),
          averageRating: Number(payload?.ratingAnalysis?.averageRating ?? 0),
          lowRatingCount: Number(payload?.ratingAnalysis?.lowRatingCount ?? 0),
          highRatingCount: Number(payload?.ratingAnalysis?.highRatingCount ?? 0),
          distribution: Array.isArray(payload?.ratingAnalysis?.distribution)
            ? payload.ratingAnalysis.distribution.map((item) => ({
                rating: Number(item.rating ?? 0),
                count: Number(item.count ?? 0)}))
            : [],
          topReviewedProducts: Array.isArray(payload?.ratingAnalysis?.topReviewedProducts)
            ? payload.ratingAnalysis.topReviewedProducts.map((item) => ({
                productID: item.productID ?? "",
                productName: item.productName ?? "",
                reviewCount: Number(item.reviewCount ?? 0),
                averageRating: Number(item.averageRating ?? 0),
                lowRatingCount: Number(item.lowRatingCount ?? 0)}))
            : [],
          lowestRatedProducts: Array.isArray(payload?.ratingAnalysis?.lowestRatedProducts)
            ? payload.ratingAnalysis.lowestRatedProducts.map((item) => ({
                productID: item.productID ?? "",
                productName: item.productName ?? "",
                reviewCount: Number(item.reviewCount ?? 0),
                averageRating: Number(item.averageRating ?? 0),
                lowRatingCount: Number(item.lowRatingCount ?? 0)}))
            : []},
        revenueByDay: Array.isArray(payload?.revenueByDay)
          ? payload.revenueByDay.map((item) => ({
              day: item.day,
              orders: Number(item.orders ?? 0),
              revenue: Number(item.revenue ?? 0)}))
          : [],
        ordersByStatus: Array.isArray(payload?.ordersByStatus)
          ? payload.ordersByStatus.map((item) => ({
              status: item.status,
              count: Number(item.count ?? 0)}))
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
              createdAt: item.createdAt ?? ""}))
          : []});
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard";
      setDashboardError(message);
      toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
    } finally {
      setLoadingDashboard(false);
    }
  }, [dashboardDays, dashboardLowStockThreshold, dashboardRecentLimit, router, token]);

  const fetchFulfillmentInsights = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/auth/staff-order-insights", {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"});
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data) {
        setFulfillmentInsights(null);
        return;
      }
      const d = payload.data as Record<string, unknown>;
      setFulfillmentInsights({
        readyToShip: Number(d.readyToShip ?? 0) || 0,
        shippedLast7Days: Number(d.shippedLast7Days ?? 0) || 0,
        pendingCheckoutOrders: Number(d.pendingCheckoutOrders ?? 0) || 0});
    } catch {
      setFulfillmentInsights(null);
    }
  }, [token]);

  const fetchShipperIncidents = useCallback(async () => {
    if (!token) return;
    setLoadingShipperIncidents(true);
    setShipperIncidentError(null);
    try {
      const response = await fetch("/api/auth/shipper-incidents", {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"});
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to load shipper incidents");
      setShipperIncidents(Array.isArray(payload) ? (payload as ShipperIncident[]) : []);
    } catch (err) {
      setShipperIncidentError(err instanceof Error ? err.message : "Failed to load shipper incidents");
    } finally {
      setLoadingShipperIncidents(false);
    }
  }, [token]);

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
            "Content-Type": "application/json"}});

        const data = await response.json();

        if (!response.ok) {
          const message = data?.message || data?.error || "Failed to load users";
          throw new Error(message);
        }

        const payload = (data?.data ?? data) as PagedUsers;
        const normalizedUsers = Array.isArray(payload?.content)
          ? payload.content.map((user) => ({
              ...user,
              role: resolveAdminUserRole(user)}))
          : [];
        setUsers(normalizedUsers);
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

  const fetchProductRequests = useCallback(async () => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoadingProductRequests(true);
    setProductRequestError(null);
    try {
      const response = await fetch("/api/auth/admin-product-requests?status=PENDING", {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"});
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load product requests");
      }
      setProductRequests(Array.isArray(data) ? data : []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load product requests";
      setProductRequestError(message);
    } finally {
      setLoadingProductRequests(false);
    }
  }, [router, token]);

  const fetchSupplierRequests = useCallback(async () => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoadingSupplierRequests(true);
    setSupplierRequestError(null);
    try {
      const response = await fetch("/api/auth/admin-supplier-requests?status=PENDING", {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"});
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load supplier requests");
      }
      setSupplierRequests(Array.isArray(data) ? data : []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load supplier requests";
      setSupplierRequestError(message);
    } finally {
      setLoadingSupplierRequests(false);
    }
  }, [router, token]);

  const fetchSellerRequests = useCallback(async () => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoadingSellerRequests(true);
    setSellerRequestError(null);
    try {
      const response = await fetch("/api/auth/admin-seller-requests?status=PENDING", {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"});
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load seller requests");
      }
      setSellerRequests(Array.isArray(data) ? data : []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load seller requests";
      setSellerRequestError(message);
    } finally {
      setLoadingSellerRequests(false);
    }
  }, [router, token]);

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
            "Content-Type": "application/json"},
          cache: "no-store"});

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || data?.error || "Failed to load products");
        }

        setProducts(
          Array.isArray(data)
            ? data.map((item) => ({
                ...item,
                sizes: Array.isArray(item?.sizes)
                  ? item.sizes
                      .map((size: unknown) => String(size ?? "").trim())
                      .filter(Boolean)
                  : [],
                category: String(item?.category ?? "").trim() || "Uncategorized",
                stockQuantity: Math.max(0, Number(item?.stockQuantity ?? 25)),
                active: item?.active !== false}))
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
          size: "10"});

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
            "Content-Type": "application/json"},
          cache: "no-store"});

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
          size: "10"});
        const searchTerm = overrides?.searchTerm ?? reviewSearchTerm;
        if (searchTerm.trim()) {
          query.set("q", searchTerm.trim());
        }

        const response = await fetch(`/api/auth/admin-reviews?${query.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json"},
          cache: "no-store"});

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
            size: String(size)});
          if (searchTerm.trim()) {
            query.set("q", searchTerm.trim());
          }

          const response = await fetch(`/api/auth/admin-reviews?${query.toString()}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json"},
            cache: "no-store"});

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
          "Content-Type": "application/json"},
        cache: "no-store"});
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
        topSellingItems: Array.isArray(data?.topSellingItems) ? data.topSellingItems : []});
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load inventory health";
      setInventoryError(message);
      toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
    } finally {
      setLoadingInventory(false);
    }
  }, [dashboardLowStockThreshold, router, token]);

  const fetchAttendance = useCallback(async () => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoadingAttendance(true);
    setAttendanceError(null);

    try {
      const params = new URLSearchParams({
        query: attendanceQuery,
        status: attendanceStatusFilter,
        reviewStatus: attendanceReviewStatusFilter,
        dateFrom: attendanceDateFrom,
        dateTo: attendanceDateTo,
        limit: "50"});

      const response = await fetch(`/api/auth/admin-attendance?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"},
        cache: "no-store"});

      const data = (await response.json()) as AdminAttendanceSnapshot & { error?: string };
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load attendance management");
      }

      setAttendanceSnapshot({
        timezone: data?.timezone ?? "UTC",
        generatedAt: Number(data?.generatedAt ?? Date.now()),
        policy: {
          monitorEnabled: Boolean(data?.policy?.monitorEnabled),
          longBreakMinutes: Number(data?.policy?.longBreakMinutes ?? 30),
          breakReminderIntervalMinutes: Number(data?.policy?.breakReminderIntervalMinutes ?? 30),
          minDailyWorkMinutes: Number(data?.policy?.minDailyWorkMinutes ?? 480),
          lowHoursReminderAfterLocalHour: Number(data?.policy?.lowHoursReminderAfterLocalHour ?? 16)},
        summary: {
          employeesTracked: Number(data?.summary?.employeesTracked ?? 0),
          activeEmployees: Number(data?.summary?.activeEmployees ?? 0),
          employeesOnBreak: Number(data?.summary?.employeesOnBreak ?? 0),
          todayWorkedMinutes: Number(data?.summary?.todayWorkedMinutes ?? 0),
          weekWorkedMinutes: Number(data?.summary?.weekWorkedMinutes ?? 0)},
        performanceSummary: {
          totalReviews: Number(data?.performanceSummary?.totalReviews ?? 0),
          openReviews: Number(data?.performanceSummary?.openReviews ?? 0),
          warningCount: Number(data?.performanceSummary?.warningCount ?? 0),
          reprimandCount: Number(data?.performanceSummary?.reprimandCount ?? 0)},
        activeShifts: Array.isArray(data?.activeShifts)
          ? data.activeShifts.map((item) => ({
              ...item,
              warningCount: Number(item?.warningCount ?? 0),
              reprimandCount: Number(item?.reprimandCount ?? 0),
              openIssueCount: Number(item?.openIssueCount ?? 0)}))
          : [],
        records: Array.isArray(data?.records)
          ? data.records.map((item) => ({
              ...item,
              warningCount: Number(item?.warningCount ?? 0),
              reprimandCount: Number(item?.reprimandCount ?? 0),
              openIssueCount: Number(item?.openIssueCount ?? 0)}))
          : [],
        performanceReviews: Array.isArray(data?.performanceReviews)
          ? data.performanceReviews.map((item) => ({
              ...item,
              lastNotifiedAt: item?.lastNotifiedAt == null ? null : Number(item.lastNotifiedAt),
              notificationCount: Number(item?.notificationCount ?? 0),
              createdAt: Number(item?.createdAt ?? 0),
              updatedAt: Number(item?.updatedAt ?? 0)}))
          : []});
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load attendance management";
      setAttendanceError(message);
      toast.error(message, { style: { backgroundColor: "#fb0404", color: "#fff" } });
    } finally {
      setLoadingAttendance(false);
    }
  }, [
    attendanceDateFrom,
    attendanceDateTo,
    attendanceQuery,
    attendanceReviewStatusFilter,
    attendanceStatusFilter,
    router,
    token,
  ]);

  const startAttendanceReview = (record: AdminAttendanceRecord) => {
    setSelectedAttendanceEmployee({
      userId: record.employee.userId,
      email: record.employee.email,
      name: record.employee.name,
      shiftId: record.shiftId ?? null});
    setAttendanceReviewType("WARNING");
    setAttendanceReviewTitle(
      record.status === "ON_BREAK" ? "Break duration requires review" : "Attendance performance review"
    );
    setAttendanceReviewSummary(record.note?.trim() || "");
    setAttendanceReviewSendEmail(true);
  };

  const resetAttendanceReviewForm = () => {
    setSelectedAttendanceEmployee(null);
    setAttendanceReviewType("WARNING");
    setAttendanceReviewTitle("");
    setAttendanceReviewSummary("");
    setAttendanceReviewSendEmail(true);
  };

  const handleCreateAttendanceReview = async () => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!selectedAttendanceEmployee) {
      toast.error("Choose an employee from the attendance table first.", {
        style: { backgroundColor: "#fb0404", color: "#fff" }});
      return;
    }

    const trimmedTitle = attendanceReviewTitle.trim();
    const trimmedSummary = attendanceReviewSummary.trim();
    if (!trimmedTitle || !trimmedSummary) {
      toast.error("Title and summary are required.", {
        style: { backgroundColor: "#fb0404", color: "#fff" }});
      return;
    }

    setAttendanceReviewProcessingKey("create");
    try {
      const response = await fetch("/api/auth/admin-attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          employeeUserId: selectedAttendanceEmployee.userId,
          employeeEmail: selectedAttendanceEmployee.email,
          employeeName: selectedAttendanceEmployee.name,
          reviewType: attendanceReviewType,
          category: "MANUAL",
          title: trimmedTitle,
          summary: trimmedSummary,
          relatedShiftId: selectedAttendanceEmployee.shiftId,
          sendEmail: attendanceReviewSendEmail})});

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to create performance review");
      }

      toast.success("Performance review saved", {
        duration: 1800,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
      resetAttendanceReviewForm();
      await fetchAttendance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create performance review", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
    } finally {
      setAttendanceReviewProcessingKey(null);
    }
  };

  const handleUpdatePerformanceReviewStatus = async (
    review: AdminPerformanceReview,
    status: AdminPerformanceReview["status"],
    resendEmail = false
  ) => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setAttendanceReviewProcessingKey(review.reviewId);
    try {
      const response = await fetch("/api/auth/admin-attendance", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          reviewId: review.reviewId,
          status,
          resendEmail})});

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update performance review");
      }

      setAttendanceSnapshot((prev) => ({
        ...prev,
        performanceReviews: prev.performanceReviews.map((item) =>
          item.reviewId === review.reviewId
            ? {
                ...item,
                status,
                notificationCount: resendEmail ? item.notificationCount + 1 : item.notificationCount,
                lastNotifiedAt: resendEmail ? Date.now() : item.lastNotifiedAt}
            : item
        )}));

      toast.success(resendEmail ? "Review updated and email resent" : "Review updated", {
        duration: 1800,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
      await fetchAttendance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update performance review", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
    } finally {
      setAttendanceReviewProcessingKey(null);
    }
  };

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
        const response = await fetch(`/api/auth/admin-audit?${q.toString()}`, { method: "GET", headers: { "Content-Type": "application/json"}, cache: "no-store" });
        const data = await response.json() as PagedAudit & { error?: string };
        if (!response.ok) throw new Error(data?.error || "Failed to load audit events");
        const parsedAuditEvents = (data?.content ?? []).map((event) => {
          if (typeof event.details === "string") {
            try {
              return { ...event, details: JSON.parse(event.details) as Record<string, unknown> };
            } catch {
              return { ...event, details: { raw: event.details } as Record<string, unknown> };
            }
          }
          return event;
        });
        setAuditEvents(parsedAuditEvents);
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
      const response = await fetch("/api/auth/admin-queues", { method: "GET", headers: { "Content-Type": "application/json"}, cache: "no-store" });
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
      const response = await fetch("/api/auth/admin-system-health", { method: "GET", headers: { "Content-Type": "application/json"}, cache: "no-store" });
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
      const response = await fetch("/api/auth/admin-notes?page=1&size=50", { method: "GET", headers: { "Content-Type": "application/json"}, cache: "no-store" });
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
      const response = await fetch("/api/auth/admin-settings", { method: "GET", headers: { "Content-Type": "application/json"}, cache: "no-store" });
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
      void fetchFulfillmentInsights();
      void fetchShipperIncidents();
    } else if (activeTab === "requests") {
      void Promise.all([fetchProductRequests(), fetchSupplierRequests(), fetchSellerRequests()]);
    } else if (activeTab === "users") {
      void fetchUsers(0);
    } else if (activeTab === "orders") {
      void fetchOrders(0);
    } else if (activeTab === "inventory") {
      void fetchInventoryHealth();
    } else if (activeTab === "attendance") {
      void fetchAttendance();
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
    fetchAttendance,
    fetchDashboard,
    fetchFulfillmentInsights,
    fetchShipperIncidents,
    fetchInventoryHealth,
    fetchNotes,
    fetchOrders,
    fetchProducts,
    fetchProductRequests,
    fetchQueues,
    fetchRatingAnalytics,
    fetchReviews,
    fetchSettings,
    fetchSystemHealth,
    fetchUsers,
    fetchSupplierRequests,
    fetchSellerRequests,
    loadedTabs,
  ]);

  useEffect(() => {
    if (
      activeTab !== "overview" &&
      activeTab !== "orders" &&
      activeTab !== "attendance" &&
      activeTab !== "queues" &&
      activeTab !== "health"
    ) return;

    const interval = activeTab === "queues" || activeTab === "health" ? 30000 : 60000;
    const timer = window.setInterval(() => {
      if (activeTab === "overview") {
        void fetchDashboard();
        void fetchFulfillmentInsights();
        void fetchShipperIncidents();
      } else if (activeTab === "orders") void fetchOrders(orderPage);
      else if (activeTab === "attendance") void fetchAttendance();
      else if (activeTab === "queues") void fetchQueues();
      else if (activeTab === "health") void fetchSystemHealth();
    }, interval);

    return () => window.clearInterval(timer);
  }, [
    activeTab,
    fetchAttendance,
    fetchDashboard,
    fetchFulfillmentInsights,
    fetchShipperIncidents,
    fetchOrders,
    fetchQueues,
    fetchSystemHealth,
    orderPage,
  ]);

  const handleRefreshActiveTab = useCallback(async () => {
    if (activeTab === "overview") {
      await fetchDashboard();
      await fetchFulfillmentInsights();
      await fetchShipperIncidents();
      return;
    }
    if (activeTab === "requests") {
      await Promise.all([fetchProductRequests(), fetchSupplierRequests(), fetchSellerRequests()]);
      return;
    }
    if (activeTab === "users") { await fetchUsers(userPage); return; }
    if (activeTab === "orders") { await fetchOrders(orderPage); return; }
    if (activeTab === "inventory") { await fetchInventoryHealth(); return; }
    if (activeTab === "attendance") { await fetchAttendance(); return; }
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
    fetchAttendance,
    fetchDashboard,
    fetchFulfillmentInsights,
    fetchShipperIncidents,
    fetchInventoryHealth,
    fetchNotes,
    fetchOrders,
    fetchProducts,
    fetchProductRequests,
    fetchQueues,
    fetchRatingAnalytics,
    fetchReviews,
    fetchSettings,
    fetchSystemHealth,
    fetchUsers,
    fetchSupplierRequests,
    fetchSellerRequests,
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
          "Content-Type": "application/json"},
        body: JSON.stringify({ userId: user.id, active: !user.active })});

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
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
    } finally {
      setUserProcessingId(null);
    }
  };

  const handleUpdateUserRole = async (
    user: AdminUser,
    nextRole: "user" | "employee" | "supplier" | "admin" | "shipper" | "seller"
  ) => {
    if (!token) {
      router.replace("/login");
      return;
    }

    const currentRole = resolveAdminUserRole(user);
    if (currentRole === nextRole) {
      return;
    }

    setUserProcessingId(user.id);
    try {
      const response = await fetch("/api/auth/admin", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({ userId: user.id, role: nextRole })});

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to update user role");
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                role: nextRole,
                roles:
                  nextRole === "admin"
                    ? ["ROLE_USER", "ROLE_ADMIN"]
                    : nextRole === "supplier"
                      ? ["ROLE_USER", "ROLE_SUPPLIER"]
                    : nextRole === "employee"
                      ? ["ROLE_USER", "ROLE_EMPLOYEE"]
                      : nextRole === "shipper"
                        ? ["ROLE_USER", "ROLE_SHIPPER"]
                        : nextRole === "seller"
                          ? ["ROLE_USER", "ROLE_SELLER"]
                        : ["ROLE_USER"]}
            : item
        )
      );
      await fetchDashboard();
      toast.success(`User role updated to ${nextRole}`, {
        duration: 2000,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user role", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
    } finally {
      setUserProcessingId(null);
    }
  };

  const handleReviewProductRequest = async (
    request: ProductChangeRequest,
    action: "approve" | "reject"
  ) => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setProductRequestProcessingId(request.id);
    try {
      const response = await fetch("/api/auth/admin-product-requests", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({ requestId: request.id, action })});

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Failed to ${action} product request`);
      }

      setProductRequests((prev) => prev.filter((item) => item.id !== request.id));
      if (loadedTabs.products) {
        await fetchProducts(productSearchTerm);
      }
      toast.success(`Product request ${action}d`, {
        duration: 2000,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} product request`, {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
    } finally {
      setProductRequestProcessingId(null);
    }
  };

  const handleReviewSupplierRequest = async (
    request: AccessRequest,
    action: "approve" | "reject"
  ) => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setSupplierRequestProcessingId(request.id);
    try {
      const response = await fetch("/api/auth/admin-supplier-requests", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({ requestId: request.id, action })});

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Failed to ${action} supplier request`);
      }

      setSupplierRequests((prev) => prev.filter((item) => item.id !== request.id));
      if (loadedTabs.users) {
        await fetchUsers(userPage);
      }
      toast.success(`Supplier request ${action}d`, {
        duration: 2000,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} supplier request`, {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
    } finally {
      setSupplierRequestProcessingId(null);
    }
  };

  const handleReviewSellerRequest = async (
    request: AccessRequest,
    action: "approve" | "reject"
  ) => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setSellerRequestProcessingId(request.id);
    try {
      const response = await fetch("/api/auth/admin-seller-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({ requestId: request.id, action })});

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Failed to ${action} seller request`);
      }

      setSellerRequests((prev) => prev.filter((item) => item.id !== request.id));
      if (loadedTabs.users) {
        await fetchUsers(userPage);
      }
      toast.success(`Seller request ${action}d`, {
        duration: 2000,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} seller request`, {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
    } finally {
      setSellerRequestProcessingId(null);
    }
  };

  const resetProductForm = () => {
    setProductForm(INITIAL_PRODUCT_FORM);
    setEditingProductId(null);
  };

  const onProductInputChange = (field: keyof Product, value: string) => {
    setProductForm((prev) => ({
      ...prev,
      [field]: field === "productPrice" || field === "stockQuantity" ? Number(value) : value}));
  };

  const toggleProductSize = (size: (typeof CLOTHING_SIZE_OPTIONS)[number]) => {
    setProductForm((prev) => {
      const hasSize = prev.sizes.includes(size);
      return {
        ...prev,
        sizes: hasSize ? prev.sizes.filter((item) => item !== size) : [...prev.sizes, size]};
    });
  };

  const handleImageUpload = async (
    field: "frontImg" | "backImg",
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file", {
        style: { backgroundColor: "#fb0404", color: "#fff" }});
      return;
    }

    try {
      if (field === "frontImg") setUploadingFront(true);
      if (field === "backImg") setUploadingBack(true);

      const imageDataUrl = await fileToDataUrl(file);
      setProductForm((prev) => ({ ...prev, [field]: imageDataUrl }));

      toast.success(`${field === "frontImg" ? "Front" : "Back"} image uploaded`, {
        duration: 1800,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed", {
        style: { backgroundColor: "#fb0404", color: "#fff" }});
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

    if (!productForm.productID.trim() || !productForm.productName.trim() || !productForm.category.trim()) {
      toast.error("Product ID, Product Name, and Category are required", {
        style: { backgroundColor: "#fb0404", color: "#fff" }});
      return;
    }
    if (productForm.sizes.length === 0) {
      toast.error("Select at least one clothing size", {
        style: { backgroundColor: "#fb0404", color: "#fff" }});
      return;
    }
    if (productForm.stockQuantity < 0) {
      toast.error("Stock quantity must be >= 0", {
        style: { backgroundColor: "#fb0404", color: "#fff" }});
      return;
    }

    setIsSavingProduct(true);
    try {
      const method = editingProductId ? "PUT" : "POST";
      const response = await fetch("/api/auth/admin-products", {
        method,
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify(productForm)});

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to save product");
      }

      toast.success(editingProductId ? "Product updated" : "Product created", {
        duration: 2000,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});

      resetProductForm();
      await fetchProducts(productSearchTerm);
      await fetchInventoryHealth();
      await fetchDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.productID);
    setProductForm({
      ...product,
      sizes: Array.isArray(product.sizes) ? product.sizes : [],
      stockQuantity: Math.max(0, Number(product.stockQuantity ?? 25)),
      active: product.active !== false});
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
          "Content-Type": "application/json"},
        body: JSON.stringify({ productID })});

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to delete product");
      }

      setProducts((prev) => prev.filter((item) => item.productID !== productID));
      toast.success("Product deleted", {
        duration: 2000,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});

      if (editingProductId === productID) {
        resetProductForm();
      }
      await fetchInventoryHealth();
      await fetchDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
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
      dateTo: ""});
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
          "Content-Type": "application/json"},
        body: JSON.stringify({ orderId, ...payload })});

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
                payment_status: payload.paymentStatus ?? order.payment_status}
            : order
        )
      );
      await fetchDashboard();

      toast.success("Order updated", {
        duration: 1800,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
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
        style: { backgroundColor: "#fb0404", color: "#fff" }});
      return;
    }

    const key = `${editingReview.productID}:${editingReview.reviewID}`;
    setReviewProcessingKey(key);
    try {
      const response = await fetch("/api/auth/admin-reviews", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          productID: editingReview.productID,
          reviewID: editingReview.reviewID,
          rating: Math.max(1, Math.min(5, reviewEditRating)),
          comment: trimmedComment})});

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
                comment: trimmedComment}
            : item
        )
      );
      toast.success("Comment updated", {
        duration: 1800,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
      cancelEditReview();
      await fetchRatingAnalytics();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update comment", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
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
          "Content-Type": "application/json"},
        body: JSON.stringify({
          productID: review.productID,
          reviewID: review.reviewID})});

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
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
      await Promise.all([fetchDashboard(), fetchRatingAnalytics()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete comment", {
        duration: 2500,
        style: { backgroundColor: "#fb0404", color: "#fff" }});
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
  const pendingAdminRequests = productRequests.length + supplierRequests.length + sellerRequests.length;

  const actionItems = useMemo(
    () => [
      {
        label: "Pending requests",
        value: pendingAdminRequests,
        detail: "Product submissions and supplier access",
        severity: pendingAdminRequests > 0 ? "high" : "low",
        tab: "requests" as AdminTab},
      {
        label: "Pending orders",
        value: dashboard.pendingOrders,
        detail: "Need fulfillment or review",
        severity: dashboard.pendingOrders > 10 ? "high" : dashboard.pendingOrders > 0 ? "medium" : "low",
        tab: "orders" as AdminTab},
      {
        label: "Low stock products",
        value: dashboard.lowStockProducts,
        detail: `At or below threshold (${dashboardLowStockThreshold})`,
        severity: dashboard.lowStockProducts > 8 ? "high" : dashboard.lowStockProducts > 0 ? "medium" : "low",
        tab: "inventory" as AdminTab},
      {
        label: "Failed payments (recent)",
        value: failedPayments,
        detail: "Orders that require payment recovery",
        severity: failedPayments > 0 ? "high" : "low",
        tab: "orders" as AdminTab},
      {
        label: "Cancelled orders",
        value: cancelledOrders,
        detail: "Potential CX or fulfillment issue",
        severity: cancelledOrders > 0 ? "medium" : "low",
        tab: "orders" as AdminTab},
    ],
    [
      cancelledOrders,
      dashboard.lowStockProducts,
      dashboard.pendingOrders,
      dashboardLowStockThreshold,
      failedPayments,
      pendingAdminRequests,
    ]
  );

  const alerts = useMemo(() => {
    const list: string[] = [];
    const openIncidents = shipperIncidents.filter((item) => item.status === "OPEN").length;
    const highIncidents = shipperIncidents.filter((item) => item.status === "OPEN" && item.severity === "HIGH").length;
    if (dashboard.pendingOrders > 15) list.push("High pending-order queue detected. Prioritize fulfillment.");
    if (dashboard.lowStockProducts > 10) list.push("Low-stock risk is elevated. Trigger restock workflow.");
    if (failedPayments > 0) list.push(`${failedPayments} failed payment(s) in recent orders.`);
    if (refundedPayments > 0) list.push(`${refundedPayments} refunded payment(s) in recent orders.`);
    if (openIncidents > 0) list.push(`${openIncidents} open shipper incident(s) require follow-up.`);
    if (highIncidents > 0) list.push(`${highIncidents} high-severity delivery issue(s) need immediate response.`);
    if (list.length === 0) list.push("No urgent operational alerts.");
    return list;
  }, [dashboard.lowStockProducts, dashboard.pendingOrders, failedPayments, refundedPayments, shipperIncidents]);

  const openShipperIncidents = useMemo(
    () => shipperIncidents.filter((item) => item.status === "OPEN"),
    [shipperIncidents]
  );
  const delayedOpenIncidents = useMemo(
    () => openShipperIncidents.filter((item) => item.incident_type === "DELIVERY_DELAY"),
    [openShipperIncidents]
  );

  const handleResolveIncident = async (incidentId: number) => {
    if (!token) return;
    setIncidentProcessingId(incidentId);
    try {
      const response = await fetch(`/api/auth/shipper-incidents/${incidentId}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json"}});
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to resolve incident");
      await fetchShipperIncidents();
      toast.success("Incident resolved", { duration: 2000, style: { backgroundColor: "#07bc0c", color: "#fff" } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve incident", {
        style: { backgroundColor: "#fb0404", color: "#fff" }});
    } finally {
      setIncidentProcessingId(null);
    }
  };

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
        headers: { "Content-Type": "application/json"},
        cache: "no-store"});
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
        headers: { "Content-Type": "application/json"}});
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
        headers: { "Content-Type": "application/json"},
        cache: "no-store"});
      const data = await response.json();
      const items = (Array.isArray(data) ? data : []) as Product[];
      const headers = ["Product ID", "Name", "Category", "Price", "Stock", "Active", "Reviews"];
      const rows = items.map((p) => [p.productID, p.productName, p.category ?? "", p.productPrice, p.stockQuantity, p.active, p.productReviews].map(escapeCsv).join(","));
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
        headers: { "Content-Type": "application/json"},
        cache: "no-store"});
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
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify(body)});
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
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ id: noteId })});
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
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ id: note.id, is_pinned: !note.is_pinned })});
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to update note");
      toast.success(note.is_pinned ? "Note unpinned" : "Note pinned", { duration: 1500, style: { backgroundColor: "#07bc0c", color: "#fff" } });
      await fetchNotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pin note", { duration: 2500, style: { backgroundColor: "#fb0404", color: "#fff" } });
    }
  };

  // ── Settings Handler ──
  const handleSaveSetting = async (key: string, fallbackValue = "") => {
    if (!token) return;
    setSavingSettingKey(key);
    try {
      const valueToSave = getSettingValue(key, fallbackValue);
      const settingDefinition = HOME_BANNER_SETTINGS.find((item) => item.key === key);
      const response = await fetch("/api/auth/admin-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({
          setting_key: key,
          setting_value: valueToSave,
          description: settingDefinition?.description})});
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to update setting");
      toast.success(`Setting "${key}" updated`, { duration: 2000, style: { backgroundColor: "#07bc0c", color: "#fff" } });
      await fetchSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save setting", { duration: 2500, style: { backgroundColor: "#fb0404", color: "#fff" } });
    } finally { setSavingSettingKey(null); }
  };

  const handleSettingImageUpload = async (
    key: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file", {
        style: { backgroundColor: "#fb0404", color: "#fff" }});
      event.target.value = "";
      return;
    }

    try {
      setUploadingSettingKey(key);
      const imageDataUrl = await fileToDataUrl(file);
      setSettingsEditValues((prev) => ({ ...prev, [key]: imageDataUrl }));
      toast.success("Banner image selected", {
        duration: 1800,
        style: { backgroundColor: "#07bc0c", color: "#fff" }});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed", {
        style: { backgroundColor: "#fb0404", color: "#fff" }});
    } finally {
      setUploadingSettingKey(null);
      event.target.value = "";
    }
  };

  useEffect(() => {
    if (activeTab !== "attendance" || !loadedTabs.attendance) return;
    void fetchAttendance();
  }, [activeTab, attendanceDateFrom, attendanceDateTo, attendanceQuery, attendanceStatusFilter, fetchAttendance, loadedTabs]);

  const ratingDistributionRows = useMemo(() => {
    const total = ratingAnalytics?.totalReviews ?? 0;
    return [5, 4, 3, 2, 1].map((rating) => {
      const count = ratingAnalytics?.distribution[rating as RatingBucket] ?? 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      return {
        rating,
        count,
        percentage};
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
          <p>Manage users, orders, product data, and customer coupon campaigns.</p>
        </div>

        <div className="adminTopBar">
          <div className="adminTopActions">
            <button className="pageButton" onClick={() => void handleRefreshActiveTab()}>
              Refresh Current Tab
            </button>
            <button className="pageButton" onClick={() => router.push("/admin/shifts")}>
              Shift Management
            </button>
            <button className="pageButton" onClick={() => router.push("/workspace/meetings")}>
              Meeting Calendar
            </button>
          </div>
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
            className={`tabButton ${activeTab === "requests" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            Requests
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
            className={`tabButton ${activeTab === "attendance" ? "tabButtonActive" : ""}`}
            onClick={() => setActiveTab("attendance")}
          >
            Attendance
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
                  <div className="overviewCard">
                    <p>Ready to dispatch</p>
                    <h3>{fulfillmentInsights?.readyToShip ?? "—"}</h3>
                    <span>Paid orders queued for fulfillment</span>
                  </div>
                  <div className="overviewCard">
                    <p>Shipped (7 days)</p>
                    <h3>{fulfillmentInsights?.shippedLast7Days ?? "—"}</h3>
                    <span>Recent completions out the door</span>
                  </div>
                  <div className="overviewCard">
                    <p>Checkout pending</p>
                    <h3>{fulfillmentInsights?.pendingCheckoutOrders ?? "—"}</h3>
                    <span>Orders still in customer checkout state</span>
                  </div>
                </div>

                <div className="overviewSections">
                  <div className="overviewSection">
                    <h3>Coupons & Vouchers</h3>
                    <p className="sectionHint">
                      
                    </p>
                    <div className="actionList">
                      <button
                        className="actionItem actionItem-info"
                        onClick={() => router.push("/admin/coupons")}
                      >
                        <strong>Open Coupon Center</strong>
                        <span>Manage campaigns</span>
                        <small>Create, issue, and track coupon confirmations.</small>
                      </button>
                      <button
                        className="actionItem actionItem-warning"
                        onClick={() => router.push("/admin/fraud")}
                      >
                        <strong>Open Fraud Center</strong>
                        <span>Review risk queue</span>
                        <small>Filter assessments and approve or reject flagged orders.</small>
                      </button>
                      <button
                        className="actionItem actionItem-success"
                        onClick={() => router.push("/admin/shifts")}
                      >
                        <strong>Open Shift Management</strong>
                        <span>Plan staffing</span>
                        <small>Create shifts, import schedules, and review staffing warnings.</small>
                      </button>
                      <button
                        className="actionItem actionItem-info"
                        onClick={() => router.push("/workspace/meetings")}
                      >
                        <strong>Open Meeting Calendar</strong>
                        <span>Schedule meetings</span>
                        <small>Book team meetings, track participants, and manage action items.</small>
                      </button>
                    </div>
                  </div>

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
                                height: `${Math.max((Number(point.revenue || 0) / maxRevenuePoint) * 100, 6)}%`}}
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
                    <h3>Shipper Management</h3>
                    <div className="insightGrid">
                      <div className="insightCard">
                        <p>Open incidents</p>
                        <h4>{openShipperIncidents.length}</h4>
                      </div>
                      <div className="insightCard">
                        <p>Delivery delays</p>
                        <h4>{delayedOpenIncidents.length}</h4>
                      </div>
                      <div className="insightCard">
                        <p>High severity</p>
                        <h4>{openShipperIncidents.filter((item) => item.severity === "HIGH").length}</h4>
                      </div>
                    </div>
                    {loadingShipperIncidents ? <p className="adminStatus">Loading incidents...</p> : null}
                    {shipperIncidentError ? <p className="adminStatus adminStatusError">{shipperIncidentError}</p> : null}
                    {!loadingShipperIncidents && !shipperIncidentError ? (
                      <table className="adminTable compactTable">
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Type</th>
                            <th>Severity</th>
                            <th>Details</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {openShipperIncidents.slice(0, 6).map((incident) => (
                            <tr key={incident.id}>
                              <td>{incident.order_number || incident.order_id}</td>
                              <td>{formatLabel(incident.incident_type)}</td>
                              <td>{incident.severity}</td>
                              <td>{incident.details || "-"}</td>
                              <td>
                                <button
                                  className="pageButton"
                                  disabled={incidentProcessingId === incident.id}
                                  onClick={() => void handleResolveIncident(incident.id)}
                                >
                                  {incidentProcessingId === incident.id ? "Resolving..." : "Resolve"}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {openShipperIncidents.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="adminEmpty">
                                No open delivery incidents.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    ) : null}
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
                      <button className="pageButton" onClick={() => setActiveTab("requests")}>
                        Review Requests
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
                                height: `${Math.max((Number(point.adds || 0) / maxWishlistAddsPoint) * 100, 6)}%`}}
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
        ) : activeTab === "requests" ? (
          <>
            {loadingProductRequests ? <p className="adminStatus">Loading product submissions...</p> : null}
            {productRequestError ? <p className="adminStatus adminStatusError">{productRequestError}</p> : null}
            {loadingSupplierRequests ? <p className="adminStatus">Loading supplier access requests...</p> : null}
            {supplierRequestError ? <p className="adminStatus adminStatusError">{supplierRequestError}</p> : null}
            {loadingSellerRequests ? <p className="adminStatus">Loading seller access requests...</p> : null}
            {sellerRequestError ? <p className="adminStatus adminStatusError">{sellerRequestError}</p> : null}

            {!loadingProductRequests && !productRequestError ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ marginBottom: 6 }}>Product Submission Requests</h3>
                  <p className="sectionHint"></p>
                </div>
                <div className="adminTableWrapper" style={{ marginBottom: 24 }}>
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Supplier</th>
                        <th>Product</th>
                        <th>Submitted</th>
                        <th>Details</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="adminEmpty">
                            No pending product submissions.
                          </td>
                        </tr>
                      ) : (
                        productRequests.map((request) => {
                          const isProcessing = productRequestProcessingId === request.id;
                          const payload = parseProductRequestPayload(request);
                          return (
                            <tr key={request.id}>
                              <td>{request.actionType}</td>
                              <td>{request.requestedByEmail || "-"}</td>
                              <td>{payload?.productName || request.targetProductId || "-"}</td>
                              <td>{request.createdAt ? formatDateTime(request.createdAt) : "-"}</td>
                              <td>
                                {[
                                  payload?.productID ? `ID: ${payload.productID}` : null,
                                  typeof payload?.productPrice === "number" ? `Price: ${formatCurrency(payload.productPrice)}` : null,
                                  typeof payload?.stockQuantity === "number" ? `Stock: ${payload.stockQuantity}` : null,
                                  Array.isArray(payload?.sizes) && payload.sizes.length > 0 ? `Sizes: ${payload.sizes.join(", ")}` : null,
                                  typeof payload?.active === "boolean" ? `Active: ${payload.active ? "Yes" : "No"}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" • ") || "Request payload available"}
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    className="adminActionButton"
                                    disabled={isProcessing}
                                    onClick={() => void handleReviewProductRequest(request, "approve")}
                                  >
                                    {isProcessing ? "Processing..." : "Approve"}
                                  </button>
                                  <button
                                    className="adminActionButton"
                                    disabled={isProcessing}
                                    onClick={() => void handleReviewProductRequest(request, "reject")}
                                  >
                                    Reject
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

                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ marginBottom: 6 }}>Supplier Access Requests</h3>
                  <p className="sectionHint"></p>
                </div>
                <div className="adminTableWrapper">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Business</th>
                        <th>Submitted</th>
                        <th>Details</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierRequests.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="adminEmpty">
                            No pending supplier access requests.
                          </td>
                        </tr>
                      ) : (
                        supplierRequests.map((request) => {
                          const isProcessing = supplierRequestProcessingId === request.id;
                          return (
                            <tr key={request.id}>
                              <td>{request.requestedByEmail || "-"}</td>
                              <td>{request.businessName || "-"}</td>
                              <td>{request.createdAt ? formatDateTime(request.createdAt) : "-"}</td>
                              <td>
                                {[request.websiteUrl, request.contactPhone, request.note]
                                  .filter(Boolean)
                                  .join(" • ") || "-"}
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    className="adminActionButton"
                                    disabled={isProcessing}
                                    onClick={() => void handleReviewSupplierRequest(request, "approve")}
                                  >
                                    {isProcessing ? "Processing..." : "Approve"}
                                  </button>
                                  <button
                                    className="adminActionButton"
                                    disabled={isProcessing}
                                    onClick={() => void handleReviewSupplierRequest(request, "reject")}
                                  >
                                    Reject
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

                <div style={{ marginTop: 20, marginBottom: 12 }}>
                  <h3 style={{ marginBottom: 6 }}>Seller Access Requests</h3>
                  <p className="sectionHint"></p>
                </div>
                <div className="adminTableWrapper">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Business</th>
                        <th>Submitted</th>
                        <th>Details</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellerRequests.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="adminEmpty">
                            No pending seller access requests.
                          </td>
                        </tr>
                      ) : (
                        sellerRequests.map((request) => {
                          const isProcessing = sellerRequestProcessingId === request.id;
                          return (
                            <tr key={request.id}>
                              <td>{request.requestedByEmail || "-"}</td>
                              <td>{request.businessName || "-"}</td>
                              <td>{request.createdAt ? formatDateTime(request.createdAt) : "-"}</td>
                              <td>
                                {[request.websiteUrl, request.contactPhone, request.note]
                                  .filter(Boolean)
                                  .join(" • ") || "-"}
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    className="adminActionButton"
                                    disabled={isProcessing}
                                    onClick={() => void handleReviewSellerRequest(request, "approve")}
                                  >
                                    {isProcessing ? "Processing..." : "Approve"}
                                  </button>
                                  <button
                                    className="adminActionButton"
                                    disabled={isProcessing}
                                    onClick={() => void handleReviewSellerRequest(request, "reject")}
                                  >
                                    Reject
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
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="adminEmpty">
                            No users found.
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => {
                          const isProcessing = userProcessingId === user.id;
                          const role = resolveAdminUserRole(user);
                          return (
                            <tr key={user.id}>
                              <td>{user.email}</td>
                              <td>{[user.firstName, user.lastName].filter(Boolean).join(" ") || "-"}</td>
                              <td>
                                <select
                                  className="productInput"
                                  value={role}
                                  disabled={isProcessing}
                                  onChange={(event) =>
                                    void handleUpdateUserRole(
                                      user,
                                      event.target.value as
                                        | "user"
                                        | "employee"
                                        | "supplier"
                                        | "shipper"
                                        | "seller"
                                        | "admin"
                                    )
                                  }
                                >
                                  <option value="user">User</option>
                                  <option value="employee">Employee</option>
                                  <option value="supplier">Supplier</option>
                                  <option value="seller">Seller</option>
                                  <option value="shipper">Shipper</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </td>
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
                                          orderStatus: event.target.value})
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
                                          paymentStatus: event.target.value})
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
            <section className="overviewSection">
              <h3></h3>
              <p>
               
              </p>
              <p>
              
              </p>
            </section>

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

                {inventoryInsights ? (
                  <div className="adminInsightPanel">
                    <div className="adminInsightHeader">
                      <h3>What Needs Attention</h3>
                      <span className="mutedCell">
                        Cart hold exposure: {inventoryInsights.stockExposure}% of current stock
                      </span>
                    </div>
                    <div className="adminInsightList">
                      {inventoryInsights.actions.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                ) : null}

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
                    <h3>Out Of Stock Products</h3>
                    <div className="adminTableWrapper">
                      <table className="adminTable">
                        <thead>
                          <tr>
                            <th>Product ID</th>
                            <th>Name</th>
                            <th>Reserved</th>
                            <th>Available</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryHealth.outOfStockItems.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="adminEmpty">No products are fully out of stock.</td>
                            </tr>
                          ) : (
                            inventoryHealth.outOfStockItems.map((item) => (
                              <tr key={`out-${item.productID}`}>
                                <td>{item.productID}</td>
                                <td>{item.productName}</td>
                                <td>{item.reservedInCarts ?? 0}</td>
                                <td>{item.availableToSell ?? 0}</td>
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

                  <div className="inventorySection">
                    <h3>Stock With No Recent Sales</h3>
                    <div className="adminTableWrapper">
                      <table className="adminTable">
                        <thead>
                          <tr>
                            <th>Product ID</th>
                            <th>Name</th>
                            <th>Available</th>
                            <th>Reserved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryHealth.noSalesItems.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="adminEmpty">No unsold stocked products found.</td>
                            </tr>
                          ) : (
                            inventoryHealth.noSalesItems.map((item) => (
                              <tr key={`nosales-${item.productID}`}>
                                <td>{item.productID}</td>
                                <td>{item.productName}</td>
                                <td>{item.availableToSell ?? item.stockQuantity}</td>
                                <td>{item.reservedInCarts ?? 0}</td>
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
                  placeholder="Category"
                  value={productForm.category}
                  onChange={(event) => onProductInputChange("category", event.target.value)}
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
                <div className="sizeSelectorCard">
                  <span className="sizeSelectorLabel">Clothing Sizes</span>
                  <div className="sizeOptionGrid">
                    {CLOTHING_SIZE_OPTIONS.map((size) => {
                      const selected = productForm.sizes.includes(size);
                      return (
                        <button
                          key={size}
                          type="button"
                          className={`sizeOptionButton${selected ? " sizeOptionButtonActive" : ""}`}
                          onClick={() => toggleProductSize(size)}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                      <th>Category</th>
                      <th>Price</th>
                      <th>Reviews</th>
                      <th>Sizes</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="adminEmpty">
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
                            <td>{product.category || "Uncategorized"}</td>
                            <td>${product.productPrice}</td>
                            <td>{product.productReviews || "-"}</td>
                            <td>{product.sizes.length > 0 ? product.sizes.join(", ") : "-"}</td>
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
        ) : activeTab === "attendance" ? (
          <>
            <section className="overviewSection">
              <h3>Employee Attendance Management</h3>
              <p>
                Track active shifts, employees currently on break, and recent attendance history from the shared
                attendance tables used by the staff portal.
              </p>
              <p>
                Gmail notifications are sent through the configured SMTP account when breaks exceed{" "}
                {attendanceSnapshot.policy.longBreakMinutes} minutes or when daily time drops below{" "}
                {formatMinutes(attendanceSnapshot.policy.minDailyWorkMinutes)} after{" "}
                {attendanceSnapshot.policy.lowHoursReminderAfterLocalHour}:00 local time.
              </p>
            </section>

            <form
              className="attendanceFilterRow"
              onSubmit={(event) => {
                event.preventDefault();
                setAttendanceQuery(attendanceQueryInput.trim());
              }}
            >
              <input
                type="text"
                className="productInput"
                placeholder="Search employee name or email"
                value={attendanceQueryInput}
                onChange={(event) => setAttendanceQueryInput(event.target.value)}
              />
              <select
                className="productInput"
                value={attendanceStatusFilter}
                onChange={(event) => setAttendanceStatusFilter(event.target.value as AdminAttendanceStatusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active shifts</option>
                <option value="on_break">On break</option>
                <option value="closed">Closed shifts</option>
              </select>
              <select
                className="productInput"
                value={attendanceReviewStatusFilter}
                onChange={(event) =>
                  setAttendanceReviewStatusFilter(event.target.value as AdminPerformanceReviewStatusFilter)
                }
              >
                <option value="all">All review statuses</option>
                <option value="OPEN">Open reviews</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
              </select>
              <input
                type="date"
                className="productInput"
                value={attendanceDateFrom}
                onChange={(event) => setAttendanceDateFrom(event.target.value)}
              />
              <input
                type="date"
                className="productInput"
                value={attendanceDateTo}
                onChange={(event) => setAttendanceDateTo(event.target.value)}
              />
              <button type="submit" className="pageButton">
                Apply
              </button>
              <button
                type="button"
                className="pageButton"
                onClick={() => {
                  setAttendanceQueryInput("");
                  setAttendanceQuery("");
                  setAttendanceStatusFilter("all");
                  setAttendanceReviewStatusFilter("all");
                  setAttendanceDateFrom("");
                  setAttendanceDateTo("");
                }}
              >
                Reset
              </button>
            </form>

            <div className="overviewCards attendanceSummaryCards">
              <div className="overviewCard">
                <p>Employees Tracked</p>
                <h3>{attendanceSnapshot.summary.employeesTracked}</h3>
                <span>Distinct employees with attendance records</span>
              </div>
              <div className="overviewCard overviewCardRevenue">
                <p>Active Shifts</p>
                <h3>{attendanceSnapshot.summary.activeEmployees}</h3>
                <span>Employees currently clocked in</span>
              </div>
              <div className="overviewCard overviewCardWarning">
                <p>On Break</p>
                <h3>{attendanceSnapshot.summary.employeesOnBreak}</h3>
                <span>Active breaks needing visibility</span>
              </div>
              <div className="overviewCard">
                <p>Worked Today</p>
                <h3>{formatMinutes(attendanceSnapshot.summary.todayWorkedMinutes)}</h3>
                <span>Across all tracked attendance entries</span>
              </div>
              <div className="overviewCard">
                <p>Worked This Week</p>
                <h3>{formatMinutes(attendanceSnapshot.summary.weekWorkedMinutes)}</h3>
                <span>Rolling 7-day workload</span>
              </div>
              <div className="overviewCard overviewCardWarning">
                <p>Warnings</p>
                <h3>{attendanceSnapshot.performanceSummary.warningCount}</h3>
                <span>Recorded attendance warnings</span>
              </div>
              <div className="overviewCard">
                <p>Reprimands</p>
                <h3>{attendanceSnapshot.performanceSummary.reprimandCount}</h3>
                <span>Escalated employee actions</span>
              </div>
              <div className="overviewCard">
                <p>Open Reviews</p>
                <h3>{attendanceSnapshot.performanceSummary.openReviews}</h3>
                <span>Negative reviews needing follow-up</span>
              </div>
            </div>

            {loadingAttendance ? <p className="adminStatus">Loading attendance management...</p> : null}
            {attendanceError ? <p className="adminStatus adminStatusError">{attendanceError}</p> : null}

            {!loadingAttendance && !attendanceError ? (
              <>
                <section className="overviewSection">
                  <div className="attendanceSectionHeader">
                    <h3>Policy Snapshot</h3>
                    <span className="statusPill">
                      Monitor: {attendanceSnapshot.policy.monitorEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="insightGrid">
                    <div className="insightCard">
                      <p>Long Break Threshold</p>
                      <h4>{formatMinutes(attendanceSnapshot.policy.longBreakMinutes)}</h4>
                    </div>
                    <div className="insightCard">
                      <p>Reminder Interval</p>
                      <h4>{formatMinutes(attendanceSnapshot.policy.breakReminderIntervalMinutes)}</h4>
                    </div>
                    <div className="insightCard">
                      <p>Daily Minimum</p>
                      <h4>{formatMinutes(attendanceSnapshot.policy.minDailyWorkMinutes)}</h4>
                    </div>
                    <div className="insightCard">
                      <p>Low-Hours Reminder</p>
                      <h4>{attendanceSnapshot.policy.lowHoursReminderAfterLocalHour}:00</h4>
                    </div>
                  </div>
                </section>

                <section className="overviewSection">
                  <div className="attendanceSectionHeader">
                    <h3>Currently Active</h3>
                    <span className="statusPill">Timezone: {attendanceSnapshot.timezone}</span>
                  </div>
                  <div className="adminTableWrapper">
                    <table className="adminTable compactTable">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Status</th>
                          <th>Clock In</th>
                          <th>Worked</th>
                          <th>Break</th>
                          <th>Warnings</th>
                          <th>Reprimands</th>
                          <th>Open Issues</th>
                          <th>Note</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceSnapshot.activeShifts.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="adminEmpty">
                              No active shifts right now.
                            </td>
                          </tr>
                        ) : (
                          attendanceSnapshot.activeShifts.map((shift) => (
                            <tr key={shift.shiftId}>
                              <td>
                                <strong>{shift.employee.name}</strong>
                                <div className="mutedCell">{shift.employee.email}</div>
                              </td>
                              <td>
                                <span className={`attendanceStatusBadge attendanceStatus-${shift.status.toLowerCase()}`}>
                                  {shift.status === "ON_BREAK" ? "On Break" : "Clocked In"}
                                </span>
                              </td>
                              <td>{formatTimestamp(shift.clockInAt)}</td>
                              <td>{formatMinutes(shift.totalWorkMinutes)}</td>
                              <td>{formatMinutes(shift.totalBreakMinutes)}</td>
                              <td>{shift.warningCount}</td>
                              <td>{shift.reprimandCount}</td>
                              <td>{shift.openIssueCount}</td>
                              <td className="commentCell">{shift.note || "-"}</td>
                              <td>
                                <button className="pageButton" onClick={() => startAttendanceReview(shift)}>
                                  Log Review
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="overviewSection">
                  <div className="attendanceSectionHeader">
                    <h3>Performance Reviews</h3>
                    <span className="mutedCell">
                      Negative reviews, warnings, and reprimands are managed here.
                    </span>
                  </div>

                  {selectedAttendanceEmployee ? (
                    <div className="productForm attendanceReviewForm">
                      <h3>
                        New Review for {selectedAttendanceEmployee.name} ({selectedAttendanceEmployee.email})
                      </h3>
                      <div className="productGrid">
                        <input className="productInput" value={selectedAttendanceEmployee.name} disabled />
                        <input className="productInput" value={selectedAttendanceEmployee.email} disabled />
                        <select
                          className="productInput"
                          value={attendanceReviewType}
                          onChange={(event) =>
                            setAttendanceReviewType(event.target.value as AdminPerformanceReview["reviewType"])
                          }
                        >
                          <option value="WARNING">Warning</option>
                          <option value="REPRIMAND">Reprimand</option>
                          <option value="NEGATIVE_REVIEW">Negative Review</option>
                        </select>
                        <input
                          className="productInput"
                          value={attendanceReviewTitle}
                          onChange={(event) => setAttendanceReviewTitle(event.target.value)}
                          placeholder="Review title"
                        />
                      </div>
                      <textarea
                        className="productInput reviewEditTextarea"
                        rows={4}
                        value={attendanceReviewSummary}
                        onChange={(event) => setAttendanceReviewSummary(event.target.value)}
                        placeholder="Describe the attendance/performance issue"
                      />
                      <label className="productToggle">
                        <input
                          type="checkbox"
                          checked={attendanceReviewSendEmail}
                          onChange={(event) => setAttendanceReviewSendEmail(event.target.checked)}
                        />
                        <span>Send Gmail notification immediately</span>
                      </label>
                      <div className="productFormActions">
                        <button
                          type="button"
                          className="adminActionButton"
                          disabled={attendanceReviewProcessingKey === "create"}
                          onClick={() => void handleCreateAttendanceReview()}
                        >
                          {attendanceReviewProcessingKey === "create" ? "Saving..." : "Save Review"}
                        </button>
                        <button type="button" className="pageButton" onClick={resetAttendanceReviewForm}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="adminStatus">Choose an employee from the attendance tables to log a review.</p>
                  )}

                  <div className="adminTableWrapper">
                    <table className="adminTable">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Summary</th>
                          <th>Notifications</th>
                          <th>Updated</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceSnapshot.performanceReviews.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="adminEmpty">
                              No performance reviews matched the current filters.
                            </td>
                          </tr>
                        ) : (
                          attendanceSnapshot.performanceReviews.map((review) => {
                            const isProcessing = attendanceReviewProcessingKey === review.reviewId;
                            return (
                              <tr key={review.reviewId}>
                                <td>
                                  <strong>{review.employeeName}</strong>
                                  <div className="mutedCell">{review.employeeEmail}</div>
                                </td>
                                <td>
                                  <div>{review.reviewType.replaceAll("_", " ")}</div>
                                  <div className="mutedCell">{review.category.replaceAll("_", " ")}</div>
                                </td>
                                <td>
                                  <select
                                    className="productInput"
                                    value={review.status}
                                    disabled={isProcessing}
                                    onChange={(event) =>
                                      void handleUpdatePerformanceReviewStatus(
                                        review,
                                        event.target.value as AdminPerformanceReview["status"]
                                      )
                                    }
                                  >
                                    <option value="OPEN">Open</option>
                                    <option value="ACKNOWLEDGED">Acknowledged</option>
                                    <option value="RESOLVED">Resolved</option>
                                  </select>
                                </td>
                                <td className="commentCell">
                                  <strong>{review.title}</strong>
                                  <div className="mutedCell">{review.summary}</div>
                                </td>
                                <td>
                                  <div>{review.notificationCount}</div>
                                  <div className="mutedCell">
                                    {review.lastNotifiedAt ? formatTimestamp(review.lastNotifiedAt) : "Not sent"}
                                  </div>
                                </td>
                                <td>{formatTimestamp(review.updatedAt)}</td>
                                <td>
                                  <div className="rowActions">
                                    <button
                                      className="pageButton"
                                      disabled={isProcessing}
                                      onClick={() =>
                                        void handleUpdatePerformanceReviewStatus(review, review.status, true)
                                      }
                                    >
                                      Resend Gmail
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
                </section>

                <section className="overviewSection">
                  <div className="attendanceSectionHeader">
                    <h3>Recent Attendance Records</h3>
                    <span className="mutedCell">
                      Updated {formatTimestamp(attendanceSnapshot.generatedAt)}
                    </span>
                  </div>
                  <div className="adminTableWrapper">
                    <table className="adminTable">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Clock In</th>
                          <th>Clock Out</th>
                          <th>Worked</th>
                          <th>Break</th>
                          <th>Warnings</th>
                          <th>Reprimands</th>
                          <th>Open Issues</th>
                          <th>Note</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceSnapshot.records.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="adminEmpty">
                              No attendance records matched the current filters.
                            </td>
                          </tr>
                        ) : (
                          attendanceSnapshot.records.map((shift) => (
                            <tr key={shift.shiftId}>
                              <td>
                                <strong>{shift.employee.name}</strong>
                                <div className="mutedCell">
                                  {shift.employee.email} · {shift.employee.role}
                                </div>
                              </td>
                              <td>{shift.shiftDate}</td>
                              <td>
                                <span className={`attendanceStatusBadge attendanceStatus-${shift.status.toLowerCase()}`}>
                                  {shift.status === "CLOCKED_OUT"
                                    ? "Closed"
                                    : shift.status === "ON_BREAK"
                                      ? "On Break"
                                      : "Active"}
                                </span>
                              </td>
                              <td>{formatTimestamp(shift.clockInAt)}</td>
                              <td>{formatTimestamp(shift.clockOutAt)}</td>
                              <td>{formatMinutes(shift.totalWorkMinutes)}</td>
                              <td>{formatMinutes(shift.totalBreakMinutes)}</td>
                              <td>{shift.warningCount}</td>
                              <td>{shift.reprimandCount}</td>
                              <td>{shift.openIssueCount}</td>
                              <td className="commentCell">{shift.note || "-"}</td>
                              <td>
                                <button className="pageButton" onClick={() => startAttendanceReview(shift)}>
                                  Log Review
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}
          </>
        ) : activeTab === "audit" ? (
          <>
            <section className="overviewSection">
              <h3></h3>
              <p>

              </p>
              <p>
                
              </p>
            </section>

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
                <div className="inventoryCards">
                  <div className="inventoryCard">
                    <p>Events On Page</p>
                    <h3>{auditEvents.length}</h3>
                  </div>
                  <div className="inventoryCard">
                    <p>Unique Actors</p>
                    <h3>{auditInsights.uniqueActors}</h3>
                  </div>
                  <div className="inventoryCard">
                    <p>Entity Types</p>
                    <h3>{auditInsights.uniqueEntities}</h3>
                  </div>
                  <div className={`inventoryCard ${auditInsights.actorlessCount > 0 ? "inventoryCardWarning" : ""}`}>
                    <p>Missing Actor Info</p>
                    <h3>{auditInsights.actorlessCount}</h3>
                  </div>
                </div>

                <div className="adminInsightPanel">
                  <div className="adminInsightHeader">
                    <h3>Audit Readout</h3>
                    <span className="mutedCell">
                      {auditInsights.mostCommonEvent
                        ? `Most common event: ${formatLabel(auditInsights.mostCommonEvent)}`
                        : "No event pattern yet"}
                    </span>
                  </div>
                  <div className="adminInsightList">
                    <p></p>
                    <p>
                      {auditEvents.length === 0
                        ? "No audit events matched the current filters. Widen the date range or confirm backend event publishing is enabled."
                        : "Start with repeated event types, blank actors, and events nearest the time a store issue was reported."}
                    </p>
                  </div>
                </div>

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
                            <td className="auditDetailCell">
                              <strong>{summarizeAuditDetails(event.details)}</strong>
                              <div className="mutedCell">{JSON.stringify(event.details, null, 2)}</div>
                            </td>
                            <td>
                              <div>{formatDateTime(event.created_at)}</div>
                              <div className="mutedCell">{formatRelativeTime(event.created_at)}</div>
                            </td>
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
            <section className="overviewSection">
              <h3></h3>
              <p>

              </p>
              <p>

              </p>
            </section>

            {loadingQueues ? <p className="adminStatus">Loading queue data...</p> : null}
            {queueError ? <p className="adminStatus adminStatusError">{queueError}</p> : null}

            {!loadingQueues && !queueError && queueData ? (
              <>
                {queueInsights ? (
                  <div className={`adminInsightPanel adminInsightPanel-${queueInsights.status}`}>
                    <div className="adminInsightHeader">
                      <h3>
                        {queueInsights.status === "critical"
                          ? "Queue Risk Detected"
                          : queueInsights.status === "attention"
                            ? "Queue Backlog Building"
                            : queueInsights.status === "unavailable"
                              ? "Queue Visibility Unavailable"
                              : "Queue Flow Looks Healthy"}
                      </h3>
                      <span className="mutedCell">
                        {queueData.databaseContext?.latestAuditEventAt
                          ? `Latest audit event ${formatRelativeTime(queueData.databaseContext.latestAuditEventAt)}`
                          : "No linked audit timing available"}
                      </span>
                    </div>
                    <div className="adminInsightList">
                      {queueInsights.actions.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                      {queueData.details ? <p>{queueData.details}</p> : null}
                    </div>
                  </div>
                ) : null}

                {queueData.databaseContext ? (
                  <div className="queueSummaryCards">
                    <div className="queueCard">
                      <p>Pending Orders (DB)</p>
                      <h3>{queueData.databaseContext.pendingOrders}</h3>
                    </div>
                    <div className="queueCard">
                      <p>Total Orders (DB)</p>
                      <h3>{queueData.databaseContext.totalOrders}</h3>
                    </div>
                    <div className="queueCard">
                      <p>Low Stock Products (DB)</p>
                      <h3>{queueData.databaseContext.lowStockProducts}</h3>
                    </div>
                    <div className="queueCard">
                      <p>Audit Events (DB)</p>
                      <h3>{queueData.databaseContext.totalAuditEvents}</h3>
                    </div>
                  </div>
                ) : null}

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
                    <h3>Queues Needing Attention</h3>
                    <div className="adminTableWrapper">
                      <table className="adminTable compactTable">
                        <thead><tr><th>Queue Name</th><th>Messages</th><th>Consumers</th><th>Issue</th></tr></thead>
                        <tbody>
                          {queueInsights && (queueInsights.stalledQueues.length > 0 || queueInsights.busyQueues.length > 0) ? (
                            [...queueInsights.stalledQueues, ...queueInsights.busyQueues.filter((queue) => queue.consumers > 0)]
                              .slice(0, 8)
                              .map((queue) => (
                                <tr key={`attention-${queue.name}`}>
                                  <td>{queue.name}</td>
                                  <td>{queue.messages}</td>
                                  <td>{queue.consumers}</td>
                                  <td>
                                    {queue.messages > 0 && queue.consumers === 0
                                      ? "Backlog with no consumer"
                                      : queue.messagesUnacked > 0
                                        ? "Messages in flight"
                                        : "Backlog present"}
                                  </td>
                                </tr>
                              ))
                          ) : (
                            <tr><td colSpan={4} className="adminEmpty">No queue issues detected right now.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="overviewSection">
                    <h3>Main Queues</h3>
                    <div className="adminTableWrapper">
                      <table className="adminTable compactTable">
                        <thead><tr><th>Queue Name</th><th>Messages</th><th>Ready</th><th>Unacked</th><th>Consumers</th><th>State</th></tr></thead>
                        <tbody>
                          {queueInsights && queueInsights.topQueues.length === 0 ? (
                            <tr><td colSpan={6} className="adminEmpty">No queues found.</td></tr>
                          ) : (
                            (queueInsights?.topQueues ?? []).map((q) => (
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
                <div className="settingsSection">
                  <h3 className="settingsSectionTitle">Home Page Banners</h3>
                  <p className="settingsSectionHint">Update all image URLs used in homepage promotional sections.</p>
                  <div className="settingsList">
                    {HOME_BANNER_SETTINGS.map((setting) => {
                      const currentValue = getSettingValue(setting.key, setting.defaultValue);
                      const baselineValue = settingsByKey[setting.key]?.setting_value ?? setting.defaultValue;
                      const unchanged = currentValue === baselineValue;
                      const isSaving = savingSettingKey === setting.key;
                      const isUploading = uploadingSettingKey === setting.key;
                      return (
                        <div key={setting.key} className="settingsRow">
                          <div className="settingsInfo">
                            <div className="settingsKey">{setting.label}</div>
                            <div className="settingsDesc">{setting.description}</div>
                            <div className="settingsDefault">Default: {setting.defaultValue}</div>
                          </div>
                          <div className="settingsValueGroup">
                            <input
                              className="settingsInput"
                              value={currentValue}
                              onChange={(e) => setSettingsEditValues((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                            />
                            <div className="settingsUploadRow">
                              <label className={`settingsUploadBtn${isUploading ? " settingsUploadBtnDisabled" : ""}`}>
                                {isUploading ? "Uploading..." : "Choose File"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploading || isSaving}
                                  onChange={(event) => void handleSettingImageUpload(setting.key, event)}
                                />
                              </label>
                              <span className="settingsUploadHint">
                                Select image from computer, then save setting.
                              </span>
                            </div>
                            {currentValue ? (
                              <div className="settingsPreviewCard">
                                <Image
                                  src={currentValue}
                                  alt={`${setting.label} preview`}
                                  className="settingsPreviewImage"
                                  width={320}
                                  height={160}
                                  unoptimized
                                />
                              </div>
                            ) : null}
                          </div>
                          <button
                            className="settingsSaveBtn"
                            disabled={isSaving || isUploading || unchanged}
                            onClick={() => void handleSaveSetting(setting.key, setting.defaultValue)}
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="settingsList">
                  {genericSettings.length === 0 ? (
                    <p className="adminStatus">No additional settings found.</p>
                  ) : (
                    genericSettings.map((setting) => (
                      <div key={setting.setting_key} className="settingsRow">
                        <div>
                          <div className="settingsKey">{setting.setting_key}</div>
                          <div className="settingsDesc">{setting.description}</div>
                        </div>
                        <input
                          className="settingsInput"
                          value={getSettingValue(setting.setting_key)}
                          onChange={(e) => setSettingsEditValues((prev) => ({ ...prev, [setting.setting_key]: e.target.value }))}
                        />
                        <button
                          className="settingsSaveBtn"
                          disabled={savingSettingKey === setting.setting_key || getSettingValue(setting.setting_key) === setting.setting_value}
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
