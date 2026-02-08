import { NextRequest, NextResponse } from "next/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "everyskill.ai";

function extractSubdomain(host: string, rootDomain: string): string | null {
  const hostname = host.split(":")[0]; // Remove port

  // Development: acme.localhost
  if (hostname.endsWith("localhost")) {
    const parts = hostname.split(".");
    // "acme.localhost" => ["acme", "localhost"]
    if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
      const sub = parts.slice(0, -1).join(".");
      return sub === "www" ? null : sub || null;
    }
    return null;
  }

  // Production: acme.everyskill.ai
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return null; // Apex or www = no subdomain
  }
  if (hostname.endsWith(`.${rootDomain}`)) {
    const sub = hostname.replace(`.${rootDomain}`, "");
    return sub === "www" ? null : sub || null;
  }

  return null;
}

export default async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const pathname = req.nextUrl.pathname;

  // === Exempt paths: skip entirely ===
  // Auth API routes must be accessible for OAuth flow
  // Also exempt: dev-login, install-callback, MCP, validate-key
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/dev-login" ||
    pathname.startsWith("/api/install-callback") ||
    pathname.startsWith("/api/mcp") ||
    pathname === "/api/validate-key" ||
    pathname === "/api/health" ||
    pathname === "/api/track" ||
    pathname === "/api/check-domain" ||
    pathname.startsWith("/api/cron")
  ) {
    return NextResponse.next();
  }

  // === Extract subdomain ===
  const subdomain = extractSubdomain(host, ROOT_DOMAIN);

  // === Set tenant context headers ===
  const requestHeaders = new Headers(req.headers);
  if (subdomain) {
    requestHeaders.set("x-tenant-slug", subdomain);
  }

  // === Vanity domain detection ===
  // If no subdomain found and host doesn't match root domain patterns,
  // treat as a potential vanity domain and set a header for downstream resolution
  const hostname = host.split(":")[0];
  if (
    !subdomain &&
    hostname !== "localhost" &&
    !hostname.endsWith(".localhost") &&
    hostname !== ROOT_DOMAIN &&
    !hostname.endsWith(`.${ROOT_DOMAIN}`) &&
    hostname !== `www.${ROOT_DOMAIN}`
  ) {
    requestHeaders.set("x-vanity-domain", hostname);
  }

  // === Auth check via cookie presence ===
  // Check for session token cookie (conditional name based on environment)
  const sessionToken =
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("authjs.session-token")?.value;

  const isLoginPage = pathname === "/login";

  // Redirect unauthenticated users to login (except login page itself)
  if (!sessionToken && !isLoginPage) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  if (sessionToken && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Forward request with tenant headers
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
