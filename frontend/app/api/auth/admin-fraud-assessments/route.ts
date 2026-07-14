import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const page = searchParams.get("page") || "0";
    const size = searchParams.get("size") || "20";
    const riskLevel = (searchParams.get("riskLevel") || "").trim();
    const manualReviewRequired = (searchParams.get("manualReviewRequired") || "").trim();
    const orderNumber = (searchParams.get("orderNumber") || "").trim();
    const customerEmail = (searchParams.get("customerEmail") || "").trim();

    const query = new URLSearchParams({ page, size });
    if (riskLevel) query.set("riskLevel", riskLevel);
    if (manualReviewRequired) query.set("manualReviewRequired", manualReviewRequired);
    if (orderNumber) query.set("orderNumber", orderNumber);
    if (customerEmail) query.set("customerEmail", customerEmail);

    const response = await fetch(`${API_URL}/v1/admin/fraud-assessments?${query.toString()}`, {
      method: "GET",
      headers: backendAuthHeaders(request),
      cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    return NextResponse.json(
      { error: "Failed to fetch fraud assessments", details: message },
      { status: 500 },
    );
  }
}
