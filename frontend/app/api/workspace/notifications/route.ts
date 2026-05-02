import { proxyJson } from "../_proxy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  return proxyJson(request, `/v1/workspace/notifications${query ? `?${query}` : ""}`, "GET");
}
