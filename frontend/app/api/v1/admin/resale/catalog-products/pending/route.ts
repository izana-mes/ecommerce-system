import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  const response = await fetch(`${backendApiBaseUrl()}/v1/admin/resale/catalog-products/pending${search}`, { headers: backendAuthHeaders(request), cache: "no-store" });
  return NextResponse.json(await response.json(), { status: response.status });
}
