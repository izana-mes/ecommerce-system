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
