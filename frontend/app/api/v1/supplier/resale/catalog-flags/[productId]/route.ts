import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();
function getErrorMessage(e: unknown) { return e instanceof Error ? e.message : String(e); }

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const { searchParams } = new URL(request.url);
    const enabled = searchParams.get("enabled") ?? "false";
    const commercialNote = searchParams.get("commercialNote") ?? "";
    const wholesalePrice = searchParams.get("wholesalePrice") ?? "";
    const minimumOrderQuantity = searchParams.get("minimumOrderQuantity") ?? "";
    const query = new URLSearchParams({ enabled });
    if (commercialNote) query.set("commercialNote", commercialNote);
    if (wholesalePrice) query.set("wholesalePrice", wholesalePrice);
    if (minimumOrderQuantity) query.set("minimumOrderQuantity", minimumOrderQuantity);
    const res = await fetch(`${API_URL}/v1/supplier/resale/catalog-flags/${encodeURIComponent(productId)}?${query}`, {
      method: "PUT",
      headers: backendAuthHeaders(request),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
