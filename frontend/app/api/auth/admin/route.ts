import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// GET - Get all users (admin only)
export async function GET(request: Request) {
  try {
        const { searchParams } = new URL(request.url);
    const page = searchParams.get("page");
    const size = searchParams.get("size");
    const query = new URLSearchParams();

    if (page) query.set("page", page);
    if (size) query.set("size", size);
    const queryString = query.toString();
    const usersUrl = `${API_URL}/v1/users${queryString ? `?${queryString}` : ""}`;

    // Call the Spring backend to get users
    const response = await fetch(usersUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"}});

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Error fetching users:", message);
    return NextResponse.json(
      {
        error: "Failed to fetch users",
        details: message},
      { status: 500 }
    );
  }
}

// PATCH - Activate/deactivate user (admin only)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
        const { userId, active } = body as { userId?: string; active?: boolean };

    if (!userId || typeof active !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: userId, active" },
        { status: 400 }
      );
    }

    const endpoint = active
      ? `${API_URL}/v1/users/${userId}/activate`
      : `${API_URL}/v1/users/${userId}/deactivate`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"}});

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Error updating user status:", message);
    return NextResponse.json(
      {
        error: "Failed to update user status",
        details: message},
      { status: 500 }
    );
  }
}

// POST - Create an admin user (should be protected in production)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Call the Spring backend register endpoint
    const response = await fetch(`${API_URL}/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"},
      // Admin creation can use the same register mechanics for now depending on role implementation
      body: JSON.stringify(body)});

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Error creating admin user:", message);
    return NextResponse.json(
      {
        error: "Failed to create admin user",
        details: message},
      { status: 500 }
    );
  }
}

// PUT - Update user role (admin only)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, role } = body;
    
    if (!userId || !role) {
      return NextResponse.json(
        { error: "Missing required fields: userId, role" },
        { status: 400 }
      );
    }

    // Call the Spring backend
    const response = await fetch(`${API_URL}/v1/users/${userId}/role`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"},
      body: JSON.stringify({ role })});

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Error updating user role:", message);
    return NextResponse.json(
      {
        error: "Failed to update user role",
        details: message},
      { status: 500 }
    );
  }
}

// DELETE - Delete user (admin only)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json(
        { error: "Missing required parameter: userId" },
        { status: 400 }
      );
    }

    // Call the Spring backend
    const response = await fetch(`${API_URL}/v1/users/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"}});

    if (!response.ok) {
      try {
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
      } catch {
        return NextResponse.json({ error: "Delete failed" }, { status: response.status });
      }
    }

    return NextResponse.json({ success: true, message: "User deleted" });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Error deleting user:", message);
    return NextResponse.json(
      {
        error: "Failed to delete user",
        details: message},
      { status: 500 }
    );
  }
}

