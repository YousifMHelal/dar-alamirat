import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config.
 *
 * This half of the config contains NO database or bcrypt access, so it
 * can run in the middleware (Edge) runtime. It defines the session
 * strategy, the custom sign-in page, and the jwt/session callbacks that
 * carry `id` + `role` through the token. The Credentials provider — which
 * needs Prisma + bcrypt (Node-only) — lives in `auth.ts`, which merges
 * this config and is used by the route handler and server helpers.
 *
 * `trustHost` is required for Auth.js v5 behind the Next.js dev/proxy host.
 */
export const authConfig = {
  trustHost: true,
  // JWT sessions: no DB session table; the role rides in the encrypted cookie.
  session: { strategy: "jwt" },
  pages: {
    // Locale-agnostic base; the locale prefix is added when we redirect.
    signIn: "/login",
  },
  providers: [], // real providers added in auth.ts (Node runtime)
  callbacks: {
    // Persist id + role onto the token at sign-in; reuse it on later calls.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    // Surface id + role from the token onto the session.user.
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
