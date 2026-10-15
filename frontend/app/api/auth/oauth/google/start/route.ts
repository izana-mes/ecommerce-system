import { NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/lib/backendApiBase";

function getRequestOrigin(request: Request, requestUrl: URL): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  const host = request.headers.get("host")?.split(",")[0]?.trim();
  if (host) {
    const proto = requestUrl.protocol ? requestUrl.protocol.replace(":", "") : "http";
    return `${proto}://${host}`;
  }
  return requestUrl.origin;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const origin = getRequestOrigin(request, requestUrl);
    const redirectUriFromQuery = requestUrl.searchParams.get("frontend_redirect_uri")?.trim();
    const frontendRedirectUri =
      redirectUriFromQuery && /^https?:\/\//i.test(redirectUriFromQuery)
        ? redirectUriFromQuery
        : `${origin}/oauth/callback`;

    // Direct browser through Next.js proxy route /oauth2/authorization/google on the current origin
    // or to public backend origin if available
    const oauthUrl = new URL("/oauth2/authorization/google", origin);
    oauthUrl.searchParams.set("frontend_redirect_uri", frontendRedirectUri);

    return NextResponse.redirect(oauthUrl.toString(), { status: 302 });
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to start Google OAuth",
        details},
      { status: 500 }
    );
  }
}
