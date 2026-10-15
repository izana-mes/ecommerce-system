import { proxyJson } from "../workspace/_proxy";

export async function GET(request: Request) {
  return proxyJson(request, "/api/v1/notifications", "GET");
}
