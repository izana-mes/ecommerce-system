import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function PATCH(request: Request, { params }: { params: { orderId: string } }) {
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
    }

    const body = (await request.json()) as { reviewStatus?: string; reviewNote?: string };
    if (!body?.reviewStatus || !body.reviewStatus.trim()) {
      return NextResponse.json({ error: "reviewStatus is required" }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/v1/admin/fraud-assessments/${orderId}/review`, {
      method: "PATCH",
      headers: backendAuthHeaders(request),
      body: JSON.stringify({
        reviewStatus: body.reviewStatus,
        reviewNote: body.reviewNote ?? "",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    return NextResponse.json(
      { error: "Failed to review fraud assessment", details: message },
      { status: 500 },
    );
  }
}
