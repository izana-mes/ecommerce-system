import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";
import { decodeCatalogId } from "@/lib/catalogId";

export const dynamic = "force-dynamic";

const API_URL = backendApiBaseUrl();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productID: string }> }
) {
  try {
    const { productID: rawProductID } = await params;
    const productID = decodeCatalogId(rawProductID);
    if (!productID) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/products/${encodeURIComponent(productID)}`, {
      method: "GET",
      headers: backendAuthHeaders(request),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to fetch product details",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
