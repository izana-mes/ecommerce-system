import { proxyJson } from "../../../workspace/_proxy";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyJson(request, `/api/v1/notifications/${encodeURIComponent(id)}/unread`, "PATCH");
}
