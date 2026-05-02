import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request): string | null {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

export async function GET(request: Request) {
  const authHeader = getAuthHeader(request);
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "workflow";

  const response = await fetch(`${API_URL}/v1/workspace/reports/export?type=${encodeURIComponent(type)}`, {
    method: "GET",
    headers: {
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    cache: "no-store",
  });

  const blob = await response.arrayBuffer();
  const disposition = response.headers.get("content-disposition") || `attachment; filename=${type}-report.csv`;
  return new Response(blob, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "text/csv; charset=utf-8",
      "Content-Disposition": disposition,
    },
  });
}
