import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");
  const isDevLogin = req.nextUrl.pathname === "/api/dev-login";
  const isInstallCallback = req.nextUrl.pathname.startsWith("/api/install-callback");
  const isMcpApi = req.nextUrl.pathname.startsWith("/api/mcp");

  // Allow auth API routes, dev login, install callback, and MCP API
  if (isAuthApi || isDevLogin || isInstallCallback || isMcpApi) {
    return;
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    // Preserve the original URL as callback
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  // Match all routes except static files, images, and auth API
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
