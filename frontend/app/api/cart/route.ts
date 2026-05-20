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
    const response = await fetch(`${API_URL}/cart`, {
      method: "GET",
      headers: backendAuthHeaders(request)});

    const data = await parseJsonOrText(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json([]);
      }
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching cart:", error?.message || error);
    return NextResponse.json(
      {
        error: "Failed to fetch cart",
        details: error?.message || String(error)},
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_URL}/cart`, {
      method: "POST",
      headers: backendAuthHeaders(request),
      body: JSON.stringify(body)});

    const data = await parseJsonOrText(response);

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error adding to cart:", error?.message || error);
    return NextResponse.json(
      {
        error: "Failed to add item to cart",
        details: error?.message || String(error)},
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { productID, quantity } = body;
    if (!productID || quantity === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: productID, quantity" },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_URL}/cart/${productID}`, {
      method: "PUT",
      headers: backendAuthHeaders(request),
      body: JSON.stringify({ quantity })});

    const data = await parseJsonOrText(response);

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating cart:", error?.message || error);
    return NextResponse.json(
      {
        error: "Failed to update cart item",
        details: error?.message || String(error)},
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

    const response = await fetch(`${API_URL}/cart/${productID}`, {
      method: "DELETE",
      headers: backendAuthHeaders(request)});

    const data = await parseJsonOrText(response);

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error removing from cart:", error?.message || error);
    return NextResponse.json(
      {
        error: "Failed to remove item from cart",
        details: error?.message || String(error)},
      { status: 500 }
    );
  }
}
