"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

export type CartMutationResult = { ok: true } | { ok: false; error: string };

export async function sendCartReminder(id: string): Promise<CartMutationResult> {
  await requireUser();
  if (!id) return { ok: false, error: "invalid" };

  const cart = await prisma.abandonedCart.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!cart) return { ok: false, error: "notFound" };
  if (cart.status !== "ACTIVE") return { ok: false, error: "notActive" };

  await prisma.abandonedCart.update({ where: { id }, data: { reminderSentAt: new Date() } });
  revalidatePath("/abandoned-carts");
  return { ok: true };
}

export async function markCartRecovered(id: string): Promise<CartMutationResult> {
  await requireUser();
  if (!id) return { ok: false, error: "invalid" };

  const cart = await prisma.abandonedCart.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!cart) return { ok: false, error: "notFound" };
  if (cart.status !== "ACTIVE") return { ok: false, error: "notActive" };

  await prisma.abandonedCart.update({ where: { id }, data: { status: "RECOVERED" } });
  revalidatePath("/abandoned-carts");
  return { ok: true };
}
