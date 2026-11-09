import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const response = await fetch(`${backendApiBaseUrl()}/v1/admin/resale/catalog-products/${encodeURIComponent(productId)}/approve`, { method: "POST", headers: backendAuthHeaders(request) });
  return new NextResponse(null, { status: response.status });
}
