import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

export async function PUT(request: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const response = await fetch(`${backendApiBaseUrl()}/v1/admin/resale/suppliers/${encodeURIComponent(supplierId)}/operating-mode`, {
    method: "PUT", headers: { ...backendAuthHeaders(request), "Content-Type": "application/json" }, body: JSON.stringify(await request.json()),
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
