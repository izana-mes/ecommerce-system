import { proxyJson } from "../../workspace/_proxy";

export async function POST(request: Request) {
  return proxyJson(request, "/v1/notifications/read-all", "POST");
}
