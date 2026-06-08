import createMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { routing } from "@/i18n/routing";

/**
 * Composed middleware: Auth.js (Edge) + next-intl locale negotiation.
 *
 * We can't use two separate middlewares, so this single proxy wraps the
 * next-intl handler with auth gating:
 *
 *   1. Strip the locale prefix to reason about the *logical* path.
 *   2. Logged-in user visiting /login  → bounce to /overview.
 *   3. Logged-out user on any protected route → bounce to /login (with a
 *      ?from= so we can return them after sign-in).
 *   4. Otherwise hand off to next-intl for locale routing.
 *
 * Auth state is read via the edge-safe `authConfig` (no Prisma/bcrypt),
 * which decrypts the JWT cookie. Per-module RBAC is enforced server-side
 * in the route layout, not here — the middleware only gates auth presence.
 */
const intlMiddleware = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

// Logical paths (locale stripped) that are reachable without a session.
const PUBLIC_PATHS = ["/login"];

/** Remove a leading /ar or /en, returning the locale-less path. */
function stripLocale(pathname: string): { locale: string; path: string } {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  if (routing.locales.includes(maybeLocale as (typeof routing.locales)[number])) {
    return { locale: maybeLocale!, path: "/" + segments.slice(2).join("/") };
  }
  return { locale: routing.defaultLocale, path: pathname };
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const { locale, path } = stripLocale(nextUrl.pathname);
  // Normalise trailing slash so "/login/" matches too.
  const logicalPath = path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
  const isPublic = PUBLIC_PATHS.includes(logicalPath);

  // Already authenticated and heading to /login → send to the app.
  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL(`/${locale}/overview`, nextUrl));
  }

  // Unauthenticated and heading to a protected route → send to /login,
  // remembering where they wanted to go.
  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, nextUrl);
    loginUrl.searchParams.set("from", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth is fine — run locale negotiation (handles `/` → `/<locale>/…`).
  return intlMiddleware(req);
});

export const config = {
  // Skip Next internals, API routes (incl. /api/auth), and static files;
  // everything else (including `/`) is locale-prefixed and auth-gated.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
