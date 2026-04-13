import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

function backendOrigin(): string {
  return backendApiBaseUrl().replace(/\/api\/?$/, "").replace(/\/+$/, "");
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const redirectUriFromQuery = requestUrl.searchParams.get("frontend_redirect_uri")?.trim();
    const frontendRedirectUri =
      redirectUriFromQuery && /^https?:\/\//i.test(redirectUriFromQuery)
        ? redirectUriFromQuery
        : `${requestUrl.origin}/oauth/callback`;

    const oauthUrl = new URL("/oauth2/authorization/google", backendOrigin());
    oauthUrl.searchParams.set("frontend_redirect_uri", frontendRedirectUri);

    return NextResponse.redirect(oauthUrl.toString(), { status: 302 });
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to start Google OAuth",
        details,
      },
      { status: 500 }
    );
  }
}
