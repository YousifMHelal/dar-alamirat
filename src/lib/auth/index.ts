import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./config";
import { loginSchema } from "./schema";

/**
 * Full Auth.js instance (Node runtime). Extends the edge-safe `authConfig`
 * with the Credentials provider, which verifies email + password against
 * the `User` table using bcrypt — so this module must NOT be imported into
 * the middleware/Edge runtime (use `authConfig` there instead).
 *
 * Exports:
 *   - `auth`     — read the session in Server Components / actions / routes
 *   - `signIn`   — used by the login server action
 *   - `signOut`  — used by the logout server action
 *   - `handlers` — GET/POST for the /api/auth/[...nextauth] route
 */
export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate shape first (defence in depth — the client validates too).
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        // Unknown email, inactive account → generic failure (no enumeration).
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) return null;

        // Returned object is what feeds the `jwt` callback's `user` arg.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
