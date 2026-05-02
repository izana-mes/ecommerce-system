// Auth utility functions

export interface User {
  id?: number | string;
  username?: string;
  email: string;
  role: "user" | "admin" | "employee" | "supplier" | "shipper";
  firstName?: string;
  lastName?: string;
}

const AUTH_STATE_EVENT = "auth-state-changed";

function notifyAuthStateChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_STATE_EVENT));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

function getUserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem("user")) return localStorage;
  if (sessionStorage.getItem("user")) return sessionStorage;
  if (localStorage.getItem("token")) return localStorage;
  if (sessionStorage.getItem("token")) return sessionStorage;
  return null;
}

function setStoredUser(user: User): void {
  const storage = getUserStorage();
  if (!storage) return;
  storage.setItem("user", JSON.stringify(user));
}

async function resolveRoleFromServer(
  token: string
): Promise<"user" | "admin" | "employee" | "supplier" | "shipper"> {
  try {
    const meResponse = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const meData = await meResponse.json();
    const profile = meData?.data;

    if (profile?.role === "admin") return "admin";
    if (profile?.role === "employee") return "employee";
    if (profile?.role === "supplier") return "supplier";
    if (profile?.role === "shipper") return "shipper";
    if (Array.isArray(profile?.roles) && profile.roles.includes("ROLE_ADMIN")) return "admin";
    if (Array.isArray(profile?.roles) && profile.roles.includes("ROLE_EMPLOYEE")) return "employee";
    if (Array.isArray(profile?.roles) && profile.roles.includes("ROLE_SUPPLIER")) return "supplier";
    if (Array.isArray(profile?.roles) && profile.roles.includes("ROLE_SHIPPER")) return "shipper";
  } catch {
    // If profile lookup fails, keep default user role.
    return "user";
  }

  return "user";
}

export async function refreshCurrentUserFromServer(): Promise<User | null> {
  const token = getToken();
  const existingUser = getUser();

  if (!token || !existingUser) {
    return existingUser;
  }

  try {
    const meResponse = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const meData = await meResponse.json();
    const profile = meData?.data;

    if (!meResponse.ok || !profile?.email) {
      return existingUser;
    }

    const role = await resolveRoleFromServer(token);
    const nextUser: User = {
      id: profile.id ?? existingUser.id,
      username: existingUser.username,
      email: profile.email ?? existingUser.email,
      role,
      firstName: profile.firstName ?? existingUser.firstName,
      lastName: profile.lastName ?? existingUser.lastName,
    };

    const unchanged =
      existingUser.email === nextUser.email &&
      existingUser.role === nextUser.role &&
      existingUser.firstName === nextUser.firstName &&
      existingUser.lastName === nextUser.lastName &&
      existingUser.id === nextUser.id;

    if (!unchanged) {
      setStoredUser(nextUser);
      notifyAuthStateChanged();
    }

    return nextUser;
  } catch {
    return existingUser;
  }
}

export function isAuthenticated(): boolean {
  return getToken() !== null || getUser() !== null;
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === "admin";
}

export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  notifyAuthStateChanged();
}

export async function logoutServerSession(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true,
    });
  } catch {
    // Logout cleanup is best effort; local logout has already been done.
  }
}

export function setAuth(token: string, user: User, remember: boolean = false): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");

  if (remember) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("user", JSON.stringify(user));
  }

  notifyAuthStateChanged();
}

export function setUserFromCookieSession(user: User, remember: boolean = false): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem("user");
  sessionStorage.removeItem("user");

  if (remember) {
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    sessionStorage.setItem("user", JSON.stringify(user));
  }

  notifyAuthStateChanged();
}

export function subscribeToAuthChanges(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => callback();
  window.addEventListener(AUTH_STATE_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(AUTH_STATE_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}
