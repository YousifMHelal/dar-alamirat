import { auth } from "./index";
import type { Role } from "@/generated/prisma/client";

/**
 * Session helpers for Server Components and server actions.
 *
 * `getCurrentUser` returns the typed session user (id, name, email, role)
 * or null. `requireUser` is the assertive variant for code paths that must
 * have an authenticated user — it throws if there is none (the middleware
 * already redirects unauthenticated requests, so reaching this without a
 * session means a misconfiguration, not a normal flow).
 */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const { id, name, email, role } = session.user;
  return { id, name: name ?? null, email: email ?? null, role };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
