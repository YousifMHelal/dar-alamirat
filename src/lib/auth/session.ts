import { auth } from "./index";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";

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

  // Guard against a stale JWT referencing a deleted/reseeded user.
  const exists = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
  if (!exists) throw new Error("Not authenticated");

  return user;
}
