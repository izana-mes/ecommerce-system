function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
}

export async function ensureCsrfToken(): Promise<void> {
  if (typeof window === "undefined") return;
  if (readCookie("XSRF-TOKEN")) return;
  await fetch("/api/auth/csrf", { credentials: "include" });
}

export function csrfHeader(): Record<string, string> {
  const token = readCookie("XSRF-TOKEN");
  return token ? { "X-XSRF-TOKEN": token } : {};
}
