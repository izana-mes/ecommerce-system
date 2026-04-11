import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";
    const size = searchParams.get("size") || "10";
    const q = (searchParams.get("q") || "").trim();

    const query = new URLSearchParams({
      page: String(Math.max(0, Number(page) - 1)),
      size,
    });
    if (q) {
      query.set("q", q);
    }

    const response = await fetch(`${API_URL}/v1/admin/reviews?${query.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
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
      { error: "Failed to fetch reviews", details: message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const body = (await request.json()) as {
      productID?: string;
      reviewID?: string;
      rating?: number;
      comment?: string;
    };

    if (!body.productID || !body.reviewID) {
      return NextResponse.json({ error: "Missing productID or reviewID" }, { status: 400 });
    }

    const response = await fetch(
      `${API_URL}/v1/admin/reviews/${encodeURIComponent(body.productID)}/${encodeURIComponent(body.reviewID)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          rating: body.rating,
          comment: body.comment,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    return NextResponse.json(
      { error: "Failed to update review", details: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const body = (await request.json()) as {
      productID?: string;
      reviewID?: string;
    };

    if (!body.productID || !body.reviewID) {
      return NextResponse.json({ error: "Missing productID or reviewID" }, { status: 400 });
    }

    const response = await fetch(
      `${API_URL}/v1/admin/reviews/${encodeURIComponent(body.productID)}/${encodeURIComponent(body.reviewID)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    return NextResponse.json(
      { error: "Failed to delete review", details: message },
      { status: 500 }
    );
  }
}
