"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { getUser, refreshCurrentUserFromServer, subscribeToAuthChanges, User } from "@/lib/auth";

import "./redeem.css";

type CouponNotificationItem = {
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
};

export default function CouponRedeemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [couponItems, setCouponItems] = useState<CouponNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const autoConfirmStarted = useRef(false);

  const assignmentId = Number(searchParams.get("assignmentId") || 0);
  const fallbackCode = (searchParams.get("coupon") || "").trim().toUpperCase();
  const fallbackTitle = (searchParams.get("title") || "").trim();
  const returnTo = useMemo(
    () => `/coupons/redeem?${searchParams.toString()}`,
    [searchParams]
  );

  useEffect(() => {
    const syncUser = () => {
      const currentUser = getUser();
      setUser(currentUser);
      if (currentUser) {
        void refreshCurrentUserFromServer().then((refreshed) => {
          if (refreshed) {
            setUser(refreshed);
          }
        });
      }
    };

    syncUser();
    return subscribeToAuthChanges(syncUser);
  }, []);

  const fetchCouponItems = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch("/api/coupons/notifications", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load coupon details");
      }
      setCouponItems(Array.isArray(data?.content) ? data.content : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load coupon details";
      toast.error(message);
      setCouponItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchCouponItems();
  }, [fetchCouponItems, user]);

  const matchedCoupon = useMemo(() => {
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return null;
    }
    return couponItems.find((item) => item.id === assignmentId) ?? null;
  }, [assignmentId, couponItems]);

  const confirmCoupon = useCallback(async () => {
    if (!user || !matchedCoupon || matchedCoupon.status !== "pending" || confirming) {
      return;
    }

    setConfirming(true);
    try {
      const response = await fetch("/api/coupons/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignmentId: matchedCoupon.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to confirm coupon");
      }
      await fetchCouponItems();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to confirm coupon";
      toast.error(message);
    } finally {
      setConfirming(false);
    }
  }, [confirming, fetchCouponItems, matchedCoupon, user]);

  useEffect(() => {
    if (!user || !matchedCoupon || matchedCoupon.status !== "pending" || autoConfirmStarted.current) {
      return;
    }

    autoConfirmStarted.current = true;
    void confirmCoupon();
  }, [confirmCoupon, matchedCoupon, user]);

  const checkoutHref = matchedCoupon
    ? `/cart?step=checkout&coupon=${encodeURIComponent(matchedCoupon.coupon.code)}`
    : fallbackCode
      ? `/cart?step=checkout&coupon=${encodeURIComponent(fallbackCode)}`
      : "/cart?step=checkout";

  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return (
      <main className="couponRedeemPage">
        <section className="couponRedeemCard">
          <span className="couponRedeemBadge couponRedeemBadgeError">Invalid link</span>
          <h1>Coupon redemption link is incomplete</h1>
          <p>This email link is missing the coupon assignment reference.</p>
          <Link href="/profile" className="couponRedeemPrimaryLink">
            Open my profile
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="couponRedeemPage">
      <section className="couponRedeemCard">
        <span className="couponRedeemBadge">Coupon redemption</span>
        <h1>{matchedCoupon?.coupon.title || fallbackTitle || "Your coupon is waiting"}</h1>
        <p>
          {matchedCoupon?.notificationMessage ||
            "Open this issued coupon, confirm it on your account, then continue to checkout."}
        </p>

        <div className="couponRedeemDetails">
          <div>
            <span className="couponRedeemLabel">Coupon code</span>
            <strong>{matchedCoupon?.coupon.code || fallbackCode || "Unavailable"}</strong>
          </div>
          <div>
            <span className="couponRedeemLabel">Status</span>
            <strong>
              {matchedCoupon
                ? matchedCoupon.status === "pending"
                  ? "Pending confirmation"
                  : matchedCoupon.status === "ready"
                    ? "Ready to use"
                    : "Already used"
                : user
                  ? loading
                    ? "Loading"
                    : "Not found on this account"
                  : "Sign in required"}
            </strong>
          </div>
        </div>

        {!user ? (
          <div className="couponRedeemActions">
            <p className="couponRedeemHint">
              Sign in with the account that received this coupon email to redeem it.
            </p>
            <Link
              href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
              className="couponRedeemPrimaryLink"
            >
              Sign in to redeem
            </Link>
          </div>
        ) : null}

        {user && loading ? <p className="couponRedeemHint">Loading your coupon details...</p> : null}

        {user && !loading && !matchedCoupon ? (
          <div className="couponRedeemActions">
            <span className="couponRedeemBadge couponRedeemBadgeError">Unavailable</span>
            <p className="couponRedeemHint">
              This coupon assignment was not found for <strong>{user.email}</strong>.
            </p>
            <Link href="/profile" className="couponRedeemSecondaryLink">
              View my coupons
            </Link>
          </div>
        ) : null}

        {user && matchedCoupon?.status === "pending" ? (
          <div className="couponRedeemActions">
            <p className="couponRedeemHint">
              {confirming ? "Confirming this coupon for your account..." : "This coupon is being prepared for checkout."}
            </p>
            <button
              type="button"
              className="couponRedeemPrimaryButton"
              onClick={() => void confirmCoupon()}
              disabled={confirming}
            >
              {confirming ? "Confirming..." : "Confirm now"}
            </button>
          </div>
        ) : null}

        {user && matchedCoupon?.status === "ready" ? (
          <div className="couponRedeemActions">
            <p className="couponRedeemHint">Your coupon is ready. Continue to checkout to apply it.</p>
            <button
              type="button"
              className="couponRedeemPrimaryButton"
              onClick={() => router.push(checkoutHref)}
            >
              Continue to checkout
            </button>
            <Link href="/profile" className="couponRedeemSecondaryLink">
              View my coupons
            </Link>
          </div>
        ) : null}

        {user && matchedCoupon?.status === "used" ? (
          <div className="couponRedeemActions">
            <span className="couponRedeemBadge couponRedeemBadgeMuted">Redeemed</span>
            <p className="couponRedeemHint">
              This coupon was already used{matchedCoupon.usedAt ? ` on ${new Date(matchedCoupon.usedAt).toLocaleString()}` : ""}.
            </p>
            <Link href="/profile" className="couponRedeemSecondaryLink">
              View my coupons
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
