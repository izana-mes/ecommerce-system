"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./profile.css";
import {
  getToken,
  getUser,
  logout as clearAuth,
  logoutServerSession,
  refreshCurrentUserFromServer,
  subscribeToAuthChanges,
  User,
} from "@/lib/auth";
import { useAppDispatch, useAppSelector } from "@/store";
import { clearCart } from "@/store/cartSlice";
import { clearWishList } from "@/store/wishListSlice";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { useLocale } from "@/components/providers/LocaleProvider";

type SupplierProductRequest = {
  id: string;
  actionType: "CREATE" | "UPDATE" | "DELETE" | "BULK_UPSERT";
  targetProductId?: string | null;
  requestPayload?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedByEmail?: string | null;
  reviewerNote?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
};

type SupplierAccessRequest = {
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
  reviewedByUserId?: string | null;
  reviewedByEmail?: string | null;
};

type SupplierProductPayload = {
  productID?: string;
  productName?: string;
  productPrice?: number;
  stockQuantity?: number;
};

type OrderItem = {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

type Order = {
  id: number;
  order_number: string;
  total_amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  created_at: string;
  items: OrderItem[];
};

type HistoryResponse = {
  content: Order[];
  totalPages: number;
};

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency || "USD"}`;
  }
}

function parseSupplierProductPayload(requestPayload?: string | null): SupplierProductPayload | null {
  if (!requestPayload) return null;
  try {
    const parsed = JSON.parse(requestPayload) as SupplierProductPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export default function ProfilePage() {
  const { t } = useLocale();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [user, setUser] = useState<User | null>(null);
  const [couponItems, setCouponItems] = useState<
    Array<{
      id: number;
      status: "pending" | "ready" | "used" | "expired";
      issuedAt: string;
      acknowledgedAt: string | null;
      usedAt: string | null;
      notificationTitle: string | null;
      notificationMessage: string | null;
      coupon: {
        code: string;
        title: string;
        description: string | null;
        discountType: "percentage" | "fixed";
        discountValue: number;
        minOrderAmount: number;
        expiresAt?: string | null;
      };
    }>
  >([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [supplierRequest, setSupplierRequest] = useState<{
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    businessName?: string | null;
    websiteUrl?: string | null;
    contactPhone?: string | null;
    note?: string | null;
    reviewerNote?: string | null;
    createdAt?: string | null;
    reviewedAt?: string | null;
  } | null>(null);
  const [supplierBusinessName, setSupplierBusinessName] = useState("");
  const [supplierWebsiteUrl, setSupplierWebsiteUrl] = useState("");
  const [supplierContactPhone, setSupplierContactPhone] = useState("");
  const [supplierRequestNote, setSupplierRequestNote] = useState("");
  const [supplierRequestLoading, setSupplierRequestLoading] = useState(false);
  const [supplierRequestSubmitting, setSupplierRequestSubmitting] = useState(false);
  const [supplierProductRequests, setSupplierProductRequests] = useState<SupplierProductRequest[]>([]);
  const [supplierProductsLoading, setSupplierProductsLoading] = useState(false);
  const [adminProductRequests, setAdminProductRequests] = useState<SupplierProductRequest[]>([]);
  const [adminProductsLoading, setAdminProductsLoading] = useState(false);
  const [adminSupplierRequests, setAdminSupplierRequests] = useState<SupplierAccessRequest[]>([]);
  const [adminSupplierRequestsLoading, setAdminSupplierRequestsLoading] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Redux Wishlist
  const wishListItems = useAppSelector((state) => Object.values(state.wishList.itemsById));
  
  useEffect(() => {
    const syncUser = () => {
      const currentUser = getUser();
      if (!currentUser) {
        setUser(null);
        router.replace("/login");
        return;
      }
      setUser(currentUser);
      void refreshCurrentUserFromServer().then((refreshed) => {
        if (refreshed) {
          setUser(refreshed);
        }
      });
    };

    syncUser();
    return subscribeToAuthChanges(syncUser);
  }, [router]);

  const fetchCouponItems = useCallback(async () => {
    setCouponLoading(true);
    try {
      const token = getToken();
      const response = await fetch("/api/coupons/notifications", {
        cache: "no-store",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load coupons");
      }
      setCouponItems(Array.isArray(data?.content) ? data.content : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load coupons";
      toast.error(message);
      setCouponItems([]);
    } finally {
      setCouponLoading(false);
    }
  }, []);

  const fetchSupplierRequest = useCallback(async () => {
    setSupplierRequestLoading(true);
    try {
      const token = typeof window === "undefined"
        ? null
        : localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        setSupplierRequest(null);
        return;
      }

      const response = await fetch("/api/auth/supplier-access", {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load supplier request");
      }

      setSupplierRequest(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load supplier request";
      toast.error(message);
      setSupplierRequest(null);
    } finally {
      setSupplierRequestLoading(false);
    }
  }, []);

  const fetchSupplierProductRequests = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setSupplierProductRequests([]);
      return;
    }

    setSupplierProductsLoading(true);
    try {
      const response = await fetch("/api/products/change-requests/mine", {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load supplier product requests");
      }
      setSupplierProductRequests(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load supplier product requests";
      toast.error(message);
      setSupplierProductRequests([]);
    } finally {
      setSupplierProductsLoading(false);
    }
  }, []);

  const fetchAdminProductRequests = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setAdminProductRequests([]);
      return;
    }

    setAdminProductsLoading(true);
    try {
      const response = await fetch("/api/auth/admin-product-requests?status=PENDING", {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load product approvals");
      }
      setAdminProductRequests(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load product approvals";
      toast.error(message);
      setAdminProductRequests([]);
    } finally {
      setAdminProductsLoading(false);
    }
  }, []);

  const fetchAdminSupplierRequests = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setAdminSupplierRequests([]);
      return;
    }

    setAdminSupplierRequestsLoading(true);
    try {
      const response = await fetch("/api/auth/admin-supplier-requests?status=PENDING", {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load supplier requests");
      }
      setAdminSupplierRequests(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load supplier requests";
      toast.error(message);
      setAdminSupplierRequests([]);
    } finally {
      setAdminSupplierRequestsLoading(false);
    }
  }, []);

  const fetchRecentOrders = useCallback(async () => {
    const token = getToken();
    setOrdersLoading(true);
    try {
      const response = await fetch("/api/orders/history?page=0&size=3", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = (await response.json()) as Partial<HistoryResponse> & {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load purchase history");
      }
      setRecentOrders(Array.isArray(data.content) ? data.content : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load purchase history";
      toast.error(message);
      setRecentOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void fetchCouponItems();
    void fetchSupplierRequest();
    void fetchRecentOrders();
    if (user.role === "supplier") {
      void fetchSupplierProductRequests();
      setAdminProductRequests([]);
      setAdminSupplierRequests([]);
    } else if (user.role === "admin") {
      void fetchAdminProductRequests();
      void fetchAdminSupplierRequests();
      setSupplierProductRequests([]);
    } else {
      setSupplierProductRequests([]);
      setAdminProductRequests([]);
      setAdminSupplierRequests([]);
    }
  }, [
    fetchAdminProductRequests,
    fetchAdminSupplierRequests,
    fetchCouponItems,
    fetchRecentOrders,
    fetchSupplierProductRequests,
    fetchSupplierRequest,
    user,
  ]);

  const pendingCouponCount = useMemo(
    () => couponItems.filter((item) => item.status === "pending").length,
    [couponItems]
  );

  const readyCouponCount = useMemo(
    () => couponItems.filter((item) => item.status === "ready").length,
    [couponItems]
  );
  const expiredCouponCount = useMemo(
    () => couponItems.filter((item) => item.status === "expired").length,
    [couponItems]
  );

  const pendingSupplierProducts = useMemo(
    () => supplierProductRequests.filter((item) => item.status === "PENDING"),
    [supplierProductRequests]
  );

  const approvedSupplierProducts = useMemo(
    () => supplierProductRequests.filter((item) => item.status === "APPROVED").length,
    [supplierProductRequests]
  );

  const adminQueueLoading = adminProductsLoading || adminSupplierRequestsLoading;

  const handleConfirmCoupon = async (assignmentId: number) => {
    setConfirmingId(assignmentId);
    try {
      const token = getToken();
      const response = await fetch("/api/coupons/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ assignmentId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to confirm coupon");
      }
      toast.success(data?.message || "Coupon confirmed");
      await fetchCouponItems();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to confirm coupon";
      toast.error(message);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleSubmitSupplierRequest = async () => {
    const token = typeof window === "undefined"
      ? null
      : localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    setSupplierRequestSubmitting(true);
    try {
      const response = await fetch("/api/auth/supplier-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessName: supplierBusinessName,
          websiteUrl: supplierWebsiteUrl,
          contactPhone: supplierContactPhone,
          note: supplierRequestNote,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to submit supplier request");
      }
      toast.success(data?.message || "Supplier access request submitted");
      setSupplierBusinessName("");
      setSupplierWebsiteUrl("");
      setSupplierContactPhone("");
      setSupplierRequestNote("");
      setSupplierRequest(data?.request ?? null);
      await refreshCurrentUserFromServer().then((refreshed) => {
        if (refreshed) {
          setUser(refreshed);
        }
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit supplier request";
      toast.error(message);
    } finally {
      setSupplierRequestSubmitting(false);
    }
  };

  const handleLogout = () => {
    // Clear auth and all per-user client state
    clearAuth();
    dispatch(clearCart());
    dispatch(clearWishList());
    void logoutServerSession();

    toast.success(t("profile_logout_success"), {
      duration: 2000,
      style: { backgroundColor: "#07bc0c", color: "#fff" },
    });

    confetti({
      particleCount: 100,
      spread: 60,
      origin: { y: 0.8 },
      zIndex: 9999,
      colors: ['#bb0000', '#ffffff'],
    });

    router.replace("/login");
  };

  if (!user) {
    return null;
  }

  const supplierRequestStatus = supplierRequest?.status || null;
  const canRequestSupplierAccess = user.role === "user" && supplierRequestStatus !== "PENDING";
  const isSupplier = user.role === "supplier";
  const isAdmin = user.role === "admin";
  const isShipper = user.role === "shipper";

  return (
    <div className="profilePage">
      <div className="profileLayout">
        <div className="profileSidebar">
          <div className="profileCard">
            <h2>{t("profile_title")}</h2>
            <div className="profileField">
              <span className="profileLabel">{t("profile_email")}</span>
              <span className="profileValue">{user.email}</span>
            </div>
            {user.firstName || user.lastName ? (
              <div className="profileField">
                <span className="profileLabel">{t("profile_name")}</span>
                <span className="profileValue">
                  {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                </span>
              </div>
            ) : null}
            <div className="profileField">
              <span className="profileLabel">{t("profile_role")}</span>
              <span className="profileValue">{user.role}</span>
            </div>
            <div className="profileField">
              <span className="profileLabel">{t("profile_orders")}</span>
              <span className="profileValue">
                <Link href="/orders">{t("profile_view_history")}</Link>
              </span>
            </div>
            {!isAdmin && !isSupplier && !isShipper ? (
              <div className="profileField">
                <span className="profileLabel">Dashboard</span>
                <span className="profileValue">
                  <Link href="/dashboard">Open dashboard</Link>
                </span>
              </div>
            ) : null}
            {isSupplier ? (
              <div className="profileField">
                <span className="profileLabel">Supplier dashboard</span>
                <span className="profileValue">
                  <Link href="/supplier/dashboard">Open dashboard</Link>
                </span>
              </div>
            ) : null}
            {isShipper ? (
              <div className="profileField">
                <span className="profileLabel">Shipper dashboard</span>
                <span className="profileValue">
                  <Link href="/shipper/dashboard">Open dashboard</Link>
                </span>
              </div>
            ) : null}
            <button className="profileLogoutButton" onClick={handleLogout}>
              {t("profile_logout")}
            </button>
          </div>

          {!isAdmin ? (
            <section className="profileCard profileHistoryCard profileHistoryCardCompact">
              <div className="profileHistoryHeader">
                <div>
                  <h2>{t("orders_history")}</h2>
                  <p>Your latest purchases in one place.</p>
                </div>
                <Link href="/orders" className="profileSecondaryButton profileLinkButton">
                  View all
                </Link>
              </div>

              {ordersLoading ? <p className="profileHistoryEmpty">Loading purchase history...</p> : null}
              {!ordersLoading && recentOrders.length === 0 ? (
                <p className="profileHistoryEmpty">No purchases yet.</p>
              ) : null}

              <div className="profileHistoryList profileHistoryListCompact">
                {recentOrders.slice(0, 3).map((order) => (
                  <article key={order.id} className="profileHistoryItem profileHistoryItemCompact">
                    <div className="profileHistoryTopRow">
                      <strong>{order.order_number}</strong>
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="profileHistoryMeta">
                      <span>{order.order_status}</span>
                      <span>{formatMoney(order.total_amount, order.currency)}</span>
                    </div>
                    <p>
                      {order.items.slice(0, 2).map((item) => item.product_name).join(", ")}
                      {order.items.length > 2 ? ` +${order.items.length - 2} more` : ""}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {!isAdmin && !isSupplier && !isShipper ? (
          <section className="profileCard profileDashboardMain">
            <div className="profileDashboardHeader">
              <h2>Welcome back, {user.firstName || 'User'}!</h2>
              <p>Here is an overview of your shopping account.</p>
            </div>

            <div className="profileMetricsRow">
              <div className="profileMetricCard">
                <span className="profileMetricIcon">📦</span>
                <div>
                  <strong>{recentOrders.length}</strong>
                  <span>Recent Orders</span>
                </div>
              </div>
              <div className="profileMetricCard">
                <span className="profileMetricIcon">❤️</span>
                <div>
                  <strong>{wishListItems.length}</strong>
                  <span>Wishlist Items</span>
                </div>
              </div>
              {supplierRequest ? (
                <div className="profileMetricCard">
                  <span className="profileMetricIcon">📝</span>
                  <div>
                    <strong>{supplierRequest.status.toLowerCase()}</strong>
                    <span>Supplier Applied</span>
                  </div>
                </div>
              ) : (
                <div 
                  className="profileMetricCard profileChatPromoCard" 
                  onClick={() => document.getElementById('chatbot-toggle-btn')?.click()}
                  role="button"
                  tabIndex={0}
                >
                  <span className="profileMetricIcon profileAiGlow">✨</span>
                  <div>
                    <strong>Ask AI</strong>
                    <span>Shopping Help</span>
                  </div>
                </div>
              )}
            </div>

            {wishListItems.length > 0 ? (
              <div className="profileWishlistPreview">
                <div className="profileWishlistHeader">
                  <h3>Your Wishlist</h3>
                  <Link href="/wishlist" className="profileLinkButton profileSecondaryButton">
                    View all
                  </Link>
                </div>
                <div className="profileWishlistGrid">
                  {wishListItems.slice(0, 3).map((item) => (
                    <article key={item.productID} className="profileWishlistItem">
                      <div className="profileWishlistInfo">
                        <h4>{item.productName}</h4>
                        <p>{formatMoney(item.productPrice, "USD")}</p>
                      </div>
                      <Link href={`/shop/${item.productID}`} className="profilePrimaryButton profileSmallBtn">
                        View Item
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {supplierRequest ? (
              <div className="profileSupplierNotice">
                <h3>Supplier Access Status</h3>
                <p>
                  Latest request: <strong className={`profileSupplierStatus profileSupplierStatus${supplierRequest.status.toLowerCase()}`}>{supplierRequest.status.toLowerCase()}</strong>
                  {supplierRequest.createdAt ? ` on ${new Date(supplierRequest.createdAt).toLocaleDateString()}` : ""}
                </p>
                {supplierRequest.businessName ? <p>Business: {supplierRequest.businessName}</p> : null}
                {supplierRequest.note ? <p>Request note: {supplierRequest.note}</p> : null}
                {supplierRequest.reviewerNote ? <p>Admin note: {supplierRequest.reviewerNote}</p> : null}
              </div>
            ) : canRequestSupplierAccess ? (
              <div className="profileSupplierMiniForm">
                <h3>Want to become a Supplier?</h3>
                <p className="profileSubtitle">Request access to sell your own products on our platform.</p>
                <div className="profileSupplierFormGrid">
                  <input
                    className="profileTextInput"
                    type="text"
                    placeholder="Business name"
                    value={supplierBusinessName}
                    onChange={(event) => setSupplierBusinessName(event.target.value)}
                  />
                  <input
                    className="profileTextInput"
                    type="url"
                    placeholder="Website or catalog URL"
                    value={supplierWebsiteUrl}
                    onChange={(event) => setSupplierWebsiteUrl(event.target.value)}
                  />
                  <input
                    className="profileTextInput"
                    type="text"
                    placeholder="Contact phone"
                    value={supplierContactPhone}
                    onChange={(event) => setSupplierContactPhone(event.target.value)}
                  />
                  <textarea
                    className="profileTextarea"
                    placeholder="Tell the admin what products you want to list"
                    value={supplierRequestNote}
                    onChange={(event) => setSupplierRequestNote(event.target.value)}
                    rows={3}
                  />
                  <button
                    type="button"
                    className="profilePrimaryButton"
                    onClick={() => void handleSubmitSupplierRequest()}
                    disabled={supplierRequestSubmitting || supplierRequestLoading}
                  >
                    {supplierRequestSubmitting ? "Submitting..." : "Apply"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="profileCard profileSupplierCard">
            <div className="profileSupplierHeader">
              <div>
                <h2>{isAdmin ? "Supplier accounts" : "Supplier account"}</h2>
                <p>
                  {isAdmin
                    ? "Monitor products that are still waiting for approval and review recent account purchases."
                    : "Track product submissions that are still waiting for admin approval."}
                </p>
              </div>
            </div>

            {isAdmin ? (
              <div className="profileSupplierSummary">
                <div className="profileSupplierMetrics">
                  <div className="profileMetric">
                    <strong>{adminProductRequests.length}</strong>
                    <span>Products under approval</span>
                  </div>
                  <div className="profileMetric">
                    <strong>{adminSupplierRequests.length}</strong>
                    <span>Suppliers in queue</span>
                  </div>
                </div>

                <div className="profilePendingList">
                  {adminQueueLoading ? <p>Loading approval queue...</p> : null}
                  {!adminQueueLoading &&
                  adminSupplierRequests.length === 0 &&
                  adminProductRequests.length === 0 ? (
                    <p>No supplier access or product submissions are currently waiting for approval.</p>
                  ) : null}
                  {!adminQueueLoading
                    ? adminSupplierRequests.slice(0, 2).map((request) => {
                        return (
                          <article key={request.id} className="profilePendingItem">
                            <div className="profilePendingItemHeader">
                              <div>
                                <h3>{request.businessName || request.requestedByEmail || "Supplier access request"}</h3>
                                <p>{request.requestedByEmail || "Unknown applicant"} · supplier access request</p>
                              </div>
                              <span className="profileSupplierStatus profileSupplierStatuspending">pending</span>
                            </div>
                            <div className="profilePendingMeta">
                              <span>
                                Submitted {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : "recently"}
                              </span>
                              {request.contactPhone ? <span>{request.contactPhone}</span> : null}
                            </div>
                          </article>
                        );
                      })
                    : null}
                  {!adminQueueLoading
                    ? adminProductRequests.slice(0, 4).map((request) => {
                        const payload = parseSupplierProductPayload(request.requestPayload);
                        const productLabel = payload?.productName || request.targetProductId || "New product submission";
                        const productId = payload?.productID || request.targetProductId;
                        return (
                          <article key={request.id} className="profilePendingItem">
                            <div className="profilePendingItemHeader">
                              <div>
                                <h3>{productLabel}</h3>
                                <p>
                                  {request.requestedByEmail || "Unknown supplier"}
                                  {" · "}
                                  {request.actionType.toLowerCase()} request
                                  {productId ? ` · ${productId}` : ""}
                                </p>
                              </div>
                              <span className="profileSupplierStatus profileSupplierStatuspending">pending</span>
                            </div>
                            <div className="profilePendingMeta">
                              <span>
                                Submitted {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : "recently"}
                              </span>
                              {typeof payload?.productPrice === "number" ? (
                                <span>{formatMoney(payload.productPrice, "USD")}</span>
                              ) : null}
                              {typeof payload?.stockQuantity === "number" ? (
                                <span>Stock {payload.stockQuantity}</span>
                              ) : null}
                            </div>
                          </article>
                        );
                      })
                    : null}
                </div>

                <div className="profileMiniSection">
                  <div className="profileMiniSectionHeader">
                    <div>
                      <h3>Purchase history</h3>
                      <p>Your latest account orders.</p>
                    </div>
                    <Link href="/orders" className="profileSecondaryButton profileLinkButton">
                      View all
                    </Link>
                  </div>
                  {ordersLoading ? <p className="profileHistoryEmpty">Loading purchase history...</p> : null}
                  {!ordersLoading && recentOrders.length === 0 ? (
                    <p className="profileHistoryEmpty">No purchases yet.</p>
                  ) : null}
                  {!ordersLoading && recentOrders.length > 0 ? (
                    <div className="profileMiniHistoryList">
                      {recentOrders.slice(0, 2).map((order) => (
                        <article key={order.id} className="profileMiniHistoryItem">
                          <div className="profileHistoryTopRow">
                            <strong>{order.order_number}</strong>
                            <span>{new Date(order.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="profileHistoryMeta">
                            <span>{order.order_status}</span>
                            <span>{formatMoney(order.total_amount, order.currency)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>

                <Link href="/admin" className="profilePrimaryButton profileLinkButton">
                  Open review queue
                </Link>
              </div>
            ) : null}

            {isSupplier ? (
              <div className="profileSupplierSummary">
                <div className="profileSupplierMetrics">
                  <div className="profileMetric">
                    <strong>{pendingSupplierProducts.length}</strong>
                    <span>Awaiting approval</span>
                  </div>
                  <div className="profileMetric">
                    <strong>{approvedSupplierProducts}</strong>
                    <span>Approved</span>
                  </div>
                </div>
                <div className="profilePendingList">
                  {supplierProductsLoading ? <p>Loading product submissions...</p> : null}
                  {!supplierProductsLoading && pendingSupplierProducts.length === 0 ? (
                    <p>No products are currently waiting for approval.</p>
                  ) : null}
                  {!supplierProductsLoading
                    ? pendingSupplierProducts.slice(0, 4).map((request) => {
                        const payload = parseSupplierProductPayload(request.requestPayload);
                        const productLabel = payload?.productName || request.targetProductId || "New product submission";
                        const productId = payload?.productID || request.targetProductId;
                        return (
                          <article key={request.id} className="profilePendingItem">
                            <div className="profilePendingItemHeader">
                              <div>
                                <h3>{productLabel}</h3>
                                <p>
                                  {request.actionType.toLowerCase()} request
                                  {productId ? ` · ${productId}` : ""}
                                </p>
                              </div>
                              <span className="profileSupplierStatus profileSupplierStatuspending">pending</span>
                            </div>
                            <div className="profilePendingMeta">
                              <span>
                                Submitted {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : "recently"}
                              </span>
                              {typeof payload?.productPrice === "number" ? (
                                <span>{formatMoney(payload.productPrice, "USD")}</span>
                              ) : null}
                              {typeof payload?.stockQuantity === "number" ? (
                                <span>Stock {payload.stockQuantity}</span>
                              ) : null}
                            </div>
                          </article>
                        );
                      })
                    : null}
                </div>
                <Link href="/supplier/dashboard" className="profilePrimaryButton profileLinkButton">
                  Open supplier dashboard
                </Link>
              </div>
            ) : null}
            {isShipper ? (
              <div className="profileSupplierSummary">
                <div className="profileSupplierHeader">
                  <div>
                    <h2>Shipper dashboard</h2>
                    <p>Track deliveries, performance metrics, and active routes in one place.</p>
                  </div>
                </div>
                <div className="profileSupplierMetrics">
                  <div className="profileMetric">
                    <strong>Overview</strong>
                    <span>Daily delivery status</span>
                  </div>
                  <div className="profileMetric">
                    <strong>Performance</strong>
                    <span>Success and timing metrics</span>
                  </div>
                </div>
                <Link href="/shipper/dashboard" className="profilePrimaryButton profileLinkButton">
                  Open shipper dashboard
                </Link>
              </div>
            ) : null}
          </section>
        )}

        <section className="profileCard profileCouponsCard">
          <div className="profileCouponsHeader">
            <div>
              <h2>Coupons & Vouchers</h2>
              <p>
                {pendingCouponCount} pending confirmation, {readyCouponCount} ready to use, {expiredCouponCount} expired
              </p>
            </div>
            <button
              type="button"
              className="profileSecondaryButton"
              onClick={() => void fetchCouponItems()}
              disabled={couponLoading}
            >
              {couponLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {couponItems.length === 0 && !couponLoading ? (
            <p className="profileCouponsEmpty">No coupons or vouchers have been issued to this account yet.</p>
          ) : null}

          <div className="profileCouponList">
            {couponItems.map((item) => (
              <article key={item.id} className="profileCouponItem">
                <div className="profileCouponStatusRow">
                  <span className={`profileCouponStatus profileCouponStatus${item.status}`}>
                    {item.status === "pending" ? "Pending" : item.status === "ready" ? "Ready" : item.status === "expired" ? "Expired" : "Used"}
                  </span>
                  <span className="profileCouponCode">{item.coupon.code}</span>
                </div>
                <h3>{item.notificationTitle || item.coupon.title}</h3>
                <p>
                  {item.status === "expired"
                    ? `This coupon expired${item.coupon.expiresAt ? ` on ${new Date(item.coupon.expiresAt).toLocaleString()}` : ""}.`
                    : item.notificationMessage || item.coupon.description || "Discount available for your next order."}
                </p>
                <div className="profileCouponMeta">
                  <span>
                    {item.coupon.discountType === "percentage"
                      ? `${item.coupon.discountValue}% off`
                      : `$${Number(item.coupon.discountValue).toFixed(2)} off`}
                  </span>
                  <span>Min order: ${Number(item.coupon.minOrderAmount || 0).toFixed(2)}</span>
                </div>
                <div className="profileCouponActions">
                  {item.status === "pending" ? (
                    <button
                      type="button"
                      className="profilePrimaryButton"
                      onClick={() => void handleConfirmCoupon(item.id)}
                      disabled={confirmingId === item.id}
                    >
                      {confirmingId === item.id ? "Confirming..." : "Confirm receipt"}
                    </button>
                  ) : null}
                  {item.status === "ready" ? (
                    <Link className="profilePrimaryButton profileLinkButton" href={`/cart?step=checkout&coupon=${encodeURIComponent(item.coupon.code)}`}>
                      Use on checkout
                    </Link>
                  ) : null}
                  {item.status === "used" ? (
                    <span className="profileUsedText">
                      Used {item.usedAt ? new Date(item.usedAt).toLocaleDateString() : ""}
                    </span>
                  ) : null}
                  {item.status === "expired" ? (
                    <span className="profileUsedText">
                      Expired {item.coupon.expiresAt ? new Date(item.coupon.expiresAt).toLocaleDateString() : ""}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
