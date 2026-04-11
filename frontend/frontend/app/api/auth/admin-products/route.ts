import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

type ProductPayload = {
  productID?: string;
  frontImg?: string;
  backImg?: string;
  productName?: string;
  productPrice?: number | string;
  productReviews?: string;
  stockQuantity?: number | string;
  active?: boolean;
};

function getAuthHeader(request: Request) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toOptionalNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const endpoint = q ? `${API_URL}/products?q=${encodeURIComponent(q)}` : `${API_URL}/products`;

    const response = await fetch(endpoint, {
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
      { error: "Failed to fetch products", details: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const body = (await request.json()) as ProductPayload;

    const response = await fetch(`${API_URL}/products/single`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        productID: body.productID,
        frontImg: body.frontImg,
        backImg: body.backImg,
        productName: body.productName,
        productPrice: Number(body.productPrice),
        productReviews: body.productReviews,
        stockQuantity: toOptionalNumber(body.stockQuantity),
        active: body.active !== false,
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
      { error: "Failed to create product", details: message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const body = (await request.json()) as ProductPayload;

    if (!body.productID) {
      return NextResponse.json({ error: "Missing productID" }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/products/${body.productID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        productID: body.productID,
        frontImg: body.frontImg,
        backImg: body.backImg,
        productName: body.productName,
        productPrice: Number(body.productPrice),
        productReviews: body.productReviews,
        stockQuantity: toOptionalNumber(body.stockQuantity),
        active: body.active !== false,
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
      { error: "Failed to update product", details: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const body = (await request.json()) as ProductPayload;

    if (!body.productID) {
      return NextResponse.json({ error: "Missing productID" }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/products/${body.productID}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    if (!response.ok) {
      try {
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
      } catch {
        return NextResponse.json({ error: "Delete failed" }, { status: response.status });
      }
    }

    return NextResponse.json({ success: true, message: "Product deleted" });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    return NextResponse.json(
      { error: "Failed to delete product", details: message },
      { status: 500 }
    );
  }
}
