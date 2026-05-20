import { API_BASE_URL } from "@/lib/backendApiBase";
import { secureApiRequest } from "@/lib/secure-api";

export { API_BASE_URL };

export async function apiCall<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" = "GET",
  body?: unknown,
): Promise<T> {
  return secureApiRequest<T>(`${API_BASE_URL}${endpoint}`, {
    method,
    body});
}
