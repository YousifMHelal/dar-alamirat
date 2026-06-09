"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { sendWhatsAppText } from "@/lib/integrations/whatsapp";

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

export type SendWhatsAppResult =
  | { ok: true; sent: boolean }
  | { ok: false; error: string };

/**
 * Send an AI-generated WhatsApp recovery message for an abandoned cart.
 * If WhatsApp credentials are not configured the message is skipped (ok: true,
 * sent: false) — staff can still copy the message manually.
 */
export async function sendCartWhatsAppMessage(
  id: string,
  message: string,
): Promise<SendWhatsAppResult> {
  await requireUser();
  if (!id || !message.trim()) return { ok: false, error: "invalid" };

  const cart = await prisma.abandonedCart.findUnique({
    where: { id },
    select: {
      status: true,
      customer: { select: { phone: true } },
    },
  });
  if (!cart) return { ok: false, error: "notFound" };
  if (cart.status !== "ACTIVE") return { ok: false, error: "notActive" };

  const phone = cart.customer.phone;
  let sent = false;

  if (phone && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    const result = await sendWhatsAppText({ to: phone, text: message });
    if (!result.ok) return { ok: false, error: result.error };
    sent = true;
  }

  await prisma.abandonedCart.update({
    where: { id },
    data: { reminderSentAt: new Date() },
  });
  revalidatePath("/abandoned-carts");
  return { ok: true, sent };
}
