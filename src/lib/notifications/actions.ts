"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

export type NotificationMutationResult = { ok: true } | { ok: false; error: string };

export async function markNotificationRead(id: string): Promise<NotificationMutationResult> {
  const user = await requireUser();
  if (!id) return { ok: false, error: "invalid" };

  const notification = await prisma.notification.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!notification) return { ok: false, error: "notFound" };
  if (notification.userId && notification.userId !== user.id) return { ok: false, error: "forbidden" };

  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<NotificationMutationResult> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { OR: [{ userId: null }, { userId: user.id }], readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  return { ok: true };
}
