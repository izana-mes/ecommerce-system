import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "workflow";

  const response = await fetch(`${API_URL}/v1/workspace/reports/export?type=${encodeURIComponent(type)}`, {
    method: "GET",
    headers: {    },
    cache: "no-store"});

  const blob = await response.arrayBuffer();
  const disposition = response.headers.get("content-disposition") || `attachment; filename=${type}-report.csv`;
  return new Response(blob, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "text/csv; charset=utf-8",
      "Content-Disposition": disposition}});
}
