import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

const API_URL = backendApiBaseUrl();

function getAuthHeader(request: NextRequest) {
  return request.headers.get("authorization") || request.headers.get("Authorization");
}

async function tryBackendLogout(request: NextRequest): Promise<void> {
  const authHeader = getAuthHeader(request);
  const cookieHeader = request.headers.get("cookie");

  const candidates = [`${API_URL}/v1/auth/logout`, `${API_URL}/logout`];

  for (const url of candidates) {
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });
      return;
    } catch {
      // Best effort only: continue trying other candidates.
    }
  }
}

export async function POST(request: NextRequest) {
  await tryBackendLogout(request);

  const response = NextResponse.json({ success: true });

  // Remove every cookie visible to this origin.
  request.cookies.getAll().forEach((cookie) => {
    response.cookies.set({
      name: cookie.name,
      value: "",
      expires: new Date(0),
      path: "/",
    });
  });

  // Common auth/session cookie names (in case not present in request parser).
  ["JSESSIONID", "SESSION", "session", "token", "access_token", "refresh_token"].forEach(
    (name) => {
      response.cookies.set({
        name,
        value: "",
        expires: new Date(0),
        path: "/",
      });
    }
  );

  return response;
}
