import { proxyJson } from "../_proxy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  return proxyJson(request, `/v1/workspace/tasks${query ? `?${query}` : ""}`, "GET");
}

export async function POST(request: Request) {
  return proxyJson(request, "/v1/workspace/tasks", "POST");
}
