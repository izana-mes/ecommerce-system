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

function notifyAuthStateChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_STATE_EVENT));
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
    loyaltyPoints: Number(profile.loyaltyPoints ?? 0)};
}

export async function refreshCurrentUserFromServer(): Promise<User | null> {
  if (typeof window === "undefined") return null;
  try {
    const user = await resolveMe();
    cachedUser = user;
    notifyAuthStateChanged();
    return user;
  } catch {
    cachedUser = null;
    notifyAuthStateChanged();
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

export function logout(): void {
  cachedUser = null;
  notifyAuthStateChanged();
}

export async function logoutServerSession(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true});
  } catch {}
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
