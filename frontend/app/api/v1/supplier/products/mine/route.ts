import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";
export async function GET(request: Request) {
  try {
    const response = await fetch(`${backendApiBaseUrl()}/v1/supplier/products/mine`, { headers: backendAuthHeaders(request), cache: "no-store" });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
