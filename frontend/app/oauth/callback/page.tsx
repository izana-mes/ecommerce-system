"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { setAuth, setUserFromCookieSession } from "@/lib/auth";
import { useAppDispatch } from "@/store";
import { fetchCartAsync } from "@/store/cartSlice";
import { fetchWishlistAsync } from "@/store/wishListSlice";

async function resolveRole(
  profile: { role?: string; roles?: string[] } | null | undefined,
  accessToken: string | null
): Promise<"user" | "admin"> {
  if (profile?.role === "admin") return "admin";
  if (Array.isArray(profile?.roles) && profile.roles.includes("ROLE_ADMIN")) return "admin";

  try {
    const adminCheck = await fetch("/api/auth/admin?page=0&size=1", {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken?.trim()
          ? { Authorization: /^bearer\s+/i.test(accessToken.trim()) ? accessToken.trim() : `Bearer ${accessToken.trim()}` }
          : {}),
      },
    });
    if (adminCheck.ok) return "admin";
  } catch {
    // Best effort only.
  }

  return "user";
}

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const syncOAuthLogin = async () => {
      const success = searchParams.get("success");
      const error = searchParams.get("error");

      if (success !== "1") {
        toast.error(error ? `OAuth failed: ${error}` : "OAuth login failed");
        router.replace("/login");
        return;
      }

      try {
        const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
        const hashParams = new URLSearchParams(hash);
        let tokenFromFragment = hashParams.get("access_token")?.trim() || null;
        if (tokenFromFragment) {
          try {
            tokenFromFragment = decodeURIComponent(tokenFromFragment);
          } catch {
            // use raw
          }
        }

        const meHeaders: HeadersInit = {
          "Content-Type": "application/json",
          ...(tokenFromFragment
            ? { Authorization: `Bearer ${tokenFromFragment}` }
            : {}),
        };

        const response = await fetch("/api/auth/me", {
          credentials: tokenFromFragment ? "same-origin" : "include",
          headers: meHeaders,
        });
        const data = await response.json();
        const userData = data?.data;

        if (!response.ok || !userData?.email) {
          const backendMsg = typeof data?.message === "string" ? data.message : "";
          const hint = tokenFromFragment
            ? "Google login returned a token, but the API did not accept it. Redeploy backend after changing JWT_SECRET_KEY, or check BACKEND_API_BASE_URL / NEXT_PUBLIC_API_URL on Vercel."
            : "No session token in the callback URL. Deploy the latest backend (OAuth redirect must include #access_token=…) and set NEXT_PUBLIC_BACKEND_URL on Vercel to your Render API origin (not this site).";
          throw new Error(backendMsg || hint);
        }

        const role = await resolveRole(userData, tokenFromFragment);
        if (tokenFromFragment) {
          setAuth(tokenFromFragment, {
            id: userData.id,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role,
          }, true);
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        } else {
          setUserFromCookieSession(
            {
              id: userData.id,
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              role,
            },
            true
          );
        }

        dispatch(fetchCartAsync());
        dispatch(fetchWishlistAsync());

        toast.success("Logged in with Google");
        router.replace("/");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "OAuth login sync failed");
        router.replace("/login");
      }
    };

    syncOAuthLogin();
  }, [dispatch, router, searchParams]);

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <p>Finishing login...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "40px", textAlign: "center" }}>
          <p>Finishing login...</p>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
