import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";
import { backendAuthHeaders } from "@/lib/proxyAuth";

const API_URL = backendApiBaseUrl();

async function parseJsonOrText(response: Response) {
  const text = await response.text();
  if (!text) return { details: "Empty response from backend" };
  try {
    return JSON.parse(text);
  } catch {
    return { details: text };
  }
}

export async function GET(request: Request) {
  try {
    const response = await fetch(`${API_URL}/wishlist`, {
      method: "GET",
      headers: backendAuthHeaders(request),
      cache: "no-store",
    });

    const data = await parseJsonOrText(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json([]);
      }
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching wishlist:", message);
    return NextResponse.json(
      {
        error: "Failed to fetch wishlist",
        details: message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_URL}/wishlist`, {
      method: "POST",
      headers: backendAuthHeaders(request),
      body: JSON.stringify(body),
    });

    const data = await parseJsonOrText(response);

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error adding to wishlist:", message);
    return NextResponse.json(
      {
        error: "Failed to add item to wishlist",
        details: message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { productID } = body;

    if (!productID) {
      return NextResponse.json(
        { error: "Missing required field: productID" },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_URL}/wishlist/${productID}`, {
      method: "DELETE",
      headers: backendAuthHeaders(request),
    });

    const data = await parseJsonOrText(response);

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error removing from wishlist:", message);
    return NextResponse.json(
      {
        error: "Failed to remove item from wishlist",
        details: message,
      },
      { status: 500 }
    );
  }
}
