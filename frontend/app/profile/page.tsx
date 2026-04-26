"use client";

import { useEffect, useState } from "react";
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

  return (
    <div className="profilePage">
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
        <button className="profileLogoutButton" onClick={handleLogout}>
          {t("profile_logout")}
        </button>
      </div>
    </div>
  );
}
