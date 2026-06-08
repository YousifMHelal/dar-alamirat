import type { Role } from "@/generated/prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Module augmentation so the user's `role` (and a guaranteed `id`) are
 * typed end-to-end: on the JWT we put it on in the `jwt` callback, and on
 * the `Session` we surface it in the `session` callback. Without this the
 * session/token would be `any`-ish at the call sites.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

// In NextAuth v5 the JWT interface is *declared* in @auth/core/jwt and
// only re-exported by next-auth/jwt, so the augmentation must target the
// declaring module for the interface merge to take effect.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
