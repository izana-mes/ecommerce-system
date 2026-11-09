import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

export async function GET(request: Request) {
  const response = await fetch(`${backendApiBaseUrl()}/v1/supplier/resale/operating-mode`, { headers: backendAuthHeaders(request), cache: "no-store" });
  return NextResponse.json(await response.json(), { status: response.status });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const response = await fetch(`${backendApiBaseUrl()}/v1/supplier/resale/operating-mode`, {
    method: "PUT", headers: { ...backendAuthHeaders(request), "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
