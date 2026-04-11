import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

export const dynamic = "force-dynamic";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: Request) {
  return (
    request.headers.get("authorization") || request.headers.get("Authorization")
  );
}

function getCookieHeader(request: Request) {
  return request.headers.get("cookie");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const authHeader = getAuthHeader(request);
    const cookieHeader = getCookieHeader(request);
    const endpoint = q
      ? `${API_URL}/products?q=${encodeURIComponent(q)}`
      : `${API_URL}/products`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (q) {
        return NextResponse.json([]);
      }
      return NextResponse.json(
        {
          error: "Failed to fetch products from backend",
          status: response.status,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (q && !Array.isArray(data)) {
      return NextResponse.json([]);
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching products:", message);
    if (new URL(request.url).searchParams.get("q")?.trim()) {
      return NextResponse.json([]);
    }
    return NextResponse.json(
      {
        error: "Backend connection failed while fetching products",
        details: message,
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const requestBody = await request.json().catch(() => null);
    if (!Array.isArray(requestBody) || requestBody.length === 0) {
      return NextResponse.json({ error: "Request body must be a non-empty product array" }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error adding products:", message);
    return NextResponse.json(
      {
        error: "Failed to add products",
        details: message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // The frontend currently doesn't pass productID in query params, so we'll read it from body
    // but the backend expects it in the URL path.
    const body = await request.json();
    const productID = body.productID;

    const authHeader = getAuthHeader(request);

    if (!productID) {
      return NextResponse.json({ error: "Missing productID" }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/products/${productID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error updating product:", message);
    return NextResponse.json(
      {
        error: "Failed to update product",
        details: message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // Read from body since it's common in this codebase
    const body = await request.json();
    const productID = body.productID;

    const authHeader = getAuthHeader(request);

    if (!productID) {
      return NextResponse.json({ error: "Missing productID" }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/products/${productID}`, {
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error deleting product:", message);
    return NextResponse.json(
      {
        error: "Failed to delete product",
        details: message,
      },
      { status: 500 }
    );
  }
}
