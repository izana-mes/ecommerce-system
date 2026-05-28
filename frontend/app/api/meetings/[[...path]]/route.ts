import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

async function proxy(request: Request, pathParts: string[] = [], method: string): Promise<Response> {
  const url = new URL(request.url);
  const path = pathParts.map(encodeURIComponent).join("/");
  const query = url.searchParams.toString();
  const cookieHeader = request.headers.get("cookie");
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  const response = await fetch(`${API_URL}/v1/meetings${path ? `/${path}` : ""}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {})},
    ...(body ? { body } : {}),
    cache: "no-store"});

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") || "application/json" }});
}

type Context = { params: Promise<{ path?: string[] }> };

export async function GET(request: Request, context: Context) {
  const { path = [] } = await context.params;
  return proxy(request, path, "GET");
}

export async function POST(request: Request, context: Context) {
  const { path = [] } = await context.params;
  return proxy(request, path, "POST");
}

export async function PUT(request: Request, context: Context) {
  const { path = [] } = await context.params;
  return proxy(request, path, "PUT");
}

export async function PATCH(request: Request, context: Context) {
  const { path = [] } = await context.params;
  return proxy(request, path, "PATCH");
}

export async function DELETE(request: Request, context: Context) {
  const { path = [] } = await context.params;
  return proxy(request, path, "DELETE");
}
