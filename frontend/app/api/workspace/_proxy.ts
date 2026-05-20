import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

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
  const body = method === "GET" ? undefined : JSON.stringify(await readJsonBody(request));
  const cookieHeader = request.headers.get("cookie");

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {})},
    ...(body ? { body } : {}),
    cache: "no-store"});

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" }});
}
