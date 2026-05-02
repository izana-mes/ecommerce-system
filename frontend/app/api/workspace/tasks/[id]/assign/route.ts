import { proxyJson } from "@/app/api/workspace/_proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyJson(request, `/v1/workspace/tasks/${encodeURIComponent(id)}/assign`, "PATCH");
}
