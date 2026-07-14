function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
}

let csrfTokenCache: string | null = null;

/** Fetch a fresh CSRF token from the BFF (syncs cookie + in-memory cache). */
export async function ensureCsrfToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/auth/csrf", {
      credentials: "include",
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { token?: string };
      if (data?.token) {
        csrfTokenCache = data.token;
        return csrfTokenCache;
      }
    }
  } catch {
    // Fall back to cookie below.
  }
  const fromCookie = readCookie("XSRF-TOKEN");
  if (fromCookie) {
    csrfTokenCache = fromCookie;
  }
  return csrfTokenCache;
}

export function csrfHeader(): Record<string, string> {
  const token = csrfTokenCache ?? readCookie("XSRF-TOKEN");
  return token ? { "X-XSRF-TOKEN": token } : {};
}

export function clearCsrfTokenCache(): void {
  csrfTokenCache = null;
}
