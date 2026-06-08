import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/** Routes incoming requests through next-intl's locale negotiation. */
export default createMiddleware(routing);

export const config = {
  // Skip Next internals, API routes, and static files; everything else
  // (including `/`) is locale-prefixed.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
