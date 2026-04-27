"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./profile.css";
import {
  getUser,
  logout as clearAuth,
  logoutServerSession,
  refreshCurrentUserFromServer,
  subscribeToAuthChanges,
  User,
} from "@/lib/auth";
import { useAppDispatch } from "@/store";
import { clearCart } from "@/store/cartSlice";
import { clearWishList } from "@/store/wishListSlice";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { useLocale } from "@/components/providers/LocaleProvider";

export default function ProfilePage() {
  const { t } = useLocale();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [user, setUser] = useState<User | null>(null);
  const [couponItems, setCouponItems] = useState<
    Array<{
      id: number;
      status: "pending" | "ready" | "used";
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
      const response = await fetch("/api/coupons/notifications", {
        cache: "no-store",
        credentials: "include",
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

  useEffect(() => {
    if (!user) return;
    void fetchCouponItems();
    void fetchSupplierRequest();
  }, [fetchCouponItems, fetchSupplierRequest, user]);

  const pendingCouponCount = useMemo(
    () => couponItems.filter((item) => item.status === "pending").length,
    [couponItems]
  );

  const readyCouponCount = useMemo(
    () => couponItems.filter((item) => item.status === "ready").length,
    [couponItems]
  );

  const handleConfirmCoupon = async (assignmentId: number) => {
    setConfirmingId(assignmentId);
    try {
      const response = await fetch("/api/coupons/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
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

  return (
    <div className="profilePage">
      <div className="profileLayout">
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
          {isSupplier ? (
            <div className="profileField">
              <span className="profileLabel">Supplier portal</span>
              <span className="profileValue">
                <Link href="/supplier">Open portal</Link>
              </span>
            </div>
          ) : null}
          <button className="profileLogoutButton" onClick={handleLogout}>
            {t("profile_logout")}
          </button>
        </div>

        <section className="profileCard profileSupplierCard">
          <div className="profileSupplierHeader">
            <div>
              <h2>Supplier access</h2>
              <p>Request permission to submit products for admin review.</p>
            </div>
            {supplierRequestStatus ? (
              <span className={`profileSupplierStatus profileSupplierStatus${supplierRequestStatus.toLowerCase()}`}>
                {supplierRequestStatus.toLowerCase()}
              </span>
            ) : null}
          </div>

          {isSupplier ? (
            <div className="profileSupplierSummary">
              <p>Your account already has supplier access.</p>
              <Link href="/supplier" className="profilePrimaryButton profileLinkButton">
                Manage product submissions
              </Link>
            </div>
          ) : null}

          {!isSupplier && supplierRequest ? (
            <div className="profileSupplierSummary">
              <p>
                Latest request: <strong>{supplierRequest.status.toLowerCase()}</strong>
                {supplierRequest.createdAt ? ` on ${new Date(supplierRequest.createdAt).toLocaleDateString()}` : ""}
              </p>
              {supplierRequest.businessName ? <p>Business: {supplierRequest.businessName}</p> : null}
              {supplierRequest.note ? <p>Request note: {supplierRequest.note}</p> : null}
              {supplierRequest.reviewerNote ? <p>Admin note: {supplierRequest.reviewerNote}</p> : null}
            </div>
          ) : null}

          {!isSupplier && canRequestSupplierAccess ? (
            <div className="profileSupplierForm">
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
                rows={4}
              />
              <button
                type="button"
                className="profilePrimaryButton"
                onClick={() => void handleSubmitSupplierRequest()}
                disabled={supplierRequestSubmitting || supplierRequestLoading}
              >
                {supplierRequestSubmitting ? "Submitting..." : "Request supplier access"}
              </button>
            </div>
          ) : null}
        </section>

        <section className="profileCard profileCouponsCard">
          <div className="profileCouponsHeader">
            <div>
              <h2>Coupons & Vouchers</h2>
              <p>
                {pendingCouponCount} pending confirmation, {readyCouponCount} ready to use
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
                    {item.status === "pending" ? "Pending" : item.status === "ready" ? "Ready" : "Used"}
                  </span>
                  <span className="profileCouponCode">{item.coupon.code}</span>
                </div>
                <h3>{item.notificationTitle || item.coupon.title}</h3>
                <p>{item.notificationMessage || item.coupon.description || "Discount available for your next order."}</p>
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
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
