/**
 * Spring API base URL including the `/api` path (e.g. https://host.onrender.com/api).
 *
 * - Set `BACKEND_API_BASE_URL` on Vercel for server-side route handlers (no rebuild needed for URL-only fixes).
 * - Set `NEXT_PUBLIC_API_URL` to the same value for the browser (OAuth "strip /api" logic) and as fallback here.
 */
export function backendApiBaseUrl(): string {
  const raw =
    process.env.BACKEND_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8080/api";
  return raw.replace(/\/+$/, "");
}

export const API_BASE_URL = backendApiBaseUrl();

/** Browser-facing Spring origin without `/api` (SockJS, OAuth, etc.). */
export function publicBackendOriginUrl(): string {
  const direct = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (direct) return direct.replace(/\/+$/, "");
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api) return api.replace(/\/+$/, "").replace(/\/api$/, "");
  return "http://localhost:8080";
}
