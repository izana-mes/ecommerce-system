import { clearCsrfTokenCache, csrfHeader, ensureCsrfToken } from "@/lib/csrf";

export interface User {
  id?: number | string;
  username?: string;
  email: string;
  role: "user" | "admin" | "employee" | "supplier" | "seller" | "shipper";
  firstName?: string;
  lastName?: string;
  loyaltyPoints?: number;
}

const AUTH_STATE_EVENT = "auth-state-changed";
let cachedUser: User | null = null;
let logoutInProgress = false;

function notifyAuthStateChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_STATE_EVENT));
}

/** Avoid firing auth-state-changed when /me returns the same session (prevents refresh↔subscriber loops). */
function usersShallowEqual(a: User | null, b: User | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    String(a.id ?? "") === String(b.id ?? "") &&
    a.email === b.email &&
    a.role === b.role &&
    (a.loyaltyPoints ?? 0) === (b.loyaltyPoints ?? 0) &&
    (a.firstName ?? "") === (b.firstName ?? "") &&
    (a.lastName ?? "") === (b.lastName ?? "") &&
    (a.username ?? "") === (b.username ?? "")
  );
}

export function getUser(): User | null {
  return cachedUser;
}

async function resolveMe(): Promise<User | null> {
  const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
  if (!res.ok) return null;
  const payload = await res.json();
  const profile = payload?.data;
  if (!profile?.email) return null;
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role || "user",
    firstName: profile.firstName || undefined,
    lastName: profile.lastName || undefined,
    loyaltyPoints: Number(profile.loyaltyPoints ?? 0),
  };
}

export async function refreshCurrentUserFromServer(): Promise<User | null> {
  if (typeof window === "undefined") return null;
  if (logoutInProgress) return null;
  const previous = cachedUser;
  try {
    const user = await resolveMe();
    cachedUser = user;
    if (!usersShallowEqual(previous, user)) {
      notifyAuthStateChanged();
    }
    return user;
  } catch {
    cachedUser = null;
    if (previous !== null) {
      notifyAuthStateChanged();
    }
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null;
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === "admin";
}

/** Clear local session immediately (UI); prefer logoutServerSession for full sign-out. */
export function logout(): void {
  cachedUser = null;
  logoutInProgress = true;
  clearCsrfTokenCache();
  notifyAuthStateChanged();
}

/** End server session and clear auth cookies via BFF, then reset local state. */
export async function logoutServerSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  logoutInProgress = true;
  try {
    await ensureCsrfToken();
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...csrfHeader(),
      },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    cachedUser = null;
    clearCsrfTokenCache();
    logoutInProgress = false;
    notifyAuthStateChanged();
  }
}

export function setAuth(_token: string, user: User, _remember: boolean = false): void {
  cachedUser = user;
  notifyAuthStateChanged();
}

export function setUserFromCookieSession(user: User, _remember: boolean = false): void {
  cachedUser = user;
  notifyAuthStateChanged();
}

export function subscribeToAuthChanges(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handleChange = () => callback();
  window.addEventListener(AUTH_STATE_EVENT, handleChange);
  return () => {
    window.removeEventListener(AUTH_STATE_EVENT, handleChange);
  };
}
