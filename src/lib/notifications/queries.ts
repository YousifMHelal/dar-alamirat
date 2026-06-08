import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export const NOTIFICATIONS_PAGE_SIZE = 20;

export type NotificationType = "ORDER" | "INVENTORY" | "SYSTEM" | "REVIEW" | "CUSTOMER";

export interface NotificationsFilter {
  type?: NotificationType;
  readState?: "UNREAD" | "READ";
  page: number;
}

async function scopedWhere(filter: NotificationsFilter) {
  const user = await getCurrentUser();
  const where: Record<string, unknown> = {
    OR: [{ userId: null }, ...(user ? [{ userId: user.id }] : [])],
  };
  if (filter.type) where.type = filter.type;
  if (filter.readState === "UNREAD") where.readAt = null;
  if (filter.readState === "READ") where.readAt = { not: null };
  return where;
}

export async function listNotifications(filter: NotificationsFilter) {
  const where = await scopedWhere(filter);
  const page = Math.max(1, filter.page);
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * NOTIFICATIONS_PAGE_SIZE,
      take: NOTIFICATIONS_PAGE_SIZE,
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true, userId: true },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE)),
  };
}

export type NotificationListRow = Awaited<ReturnType<typeof listNotifications>>["rows"][number];

export interface NotificationStats {
  unread: number;
  byType: Record<NotificationType, number>;
}

export async function getNotificationStats(): Promise<NotificationStats> {
  const user = await getCurrentUser();
  const scope = { OR: [{ userId: null }, ...(user ? [{ userId: user.id }] : [])] };

  const types: readonly NotificationType[] = ["ORDER", "INVENTORY", "SYSTEM", "REVIEW", "CUSTOMER"];
  const [unread, ...byTypeCounts] = await Promise.all([
    prisma.notification.count({ where: { ...scope, readAt: null } }),
    ...types.map((type) => prisma.notification.count({ where: { ...scope, type } })),
  ]);

  const byType = Object.fromEntries(types.map((type, i) => [type, byTypeCounts[i] ?? 0])) as Record<
    NotificationType,
    number
  >;

  return { unread, byType };
}
