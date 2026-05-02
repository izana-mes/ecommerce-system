import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export function getAuthHeader(request: Request): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (!raw) return {};
  return JSON.parse(raw);
}

export async function proxyJson(
  request: Request,
  endpoint: string,
  method: "GET" | "POST" | "PATCH"
): Promise<Response> {
  const authHeader = getAuthHeader(request);
  const body = method === "GET" ? undefined : JSON.stringify(await readJsonBody(request));

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    ...(body ? { body } : {}),
    cache: "no-store",
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
