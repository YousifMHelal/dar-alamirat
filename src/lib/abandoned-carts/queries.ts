import { prisma } from "@/lib/prisma";

export const ABANDONED_CARTS_PAGE_SIZE = 15;

export interface CartItemSnapshot {
  name: string;
  quantity: number;
  price: string;
}

export interface AbandonedCartsFilter {
  status?: "ACTIVE" | "RECOVERED" | "EXPIRED";
  page: number;
}

function buildWhere(filter: AbandonedCartsFilter) {
  return filter.status ? { status: filter.status } : {};
}

export async function listAbandonedCarts(filter: AbandonedCartsFilter) {
  const where = buildWhere(filter);
  const page = Math.max(1, filter.page);
  const [rows, total] = await Promise.all([
    prisma.abandonedCart.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      skip: (page - 1) * ABANDONED_CARTS_PAGE_SIZE,
      take: ABANDONED_CARTS_PAGE_SIZE,
      select: {
        id: true,
        subtotal: true,
        status: true,
        lastActivityAt: true,
        recoveryLink: true,
        reminderSentAt: true,
        items: true,
        customer: { select: { id: true, name: true, phone: true, type: true } },
      },
    }),
    prisma.abandonedCart.count({ where }),
  ]);

  return {
    rows: rows.map((c) => {
      const items = Array.isArray(c.items) ? (c.items as unknown as CartItemSnapshot[]) : [];
      return {
        id: c.id,
        subtotal: c.subtotal.toFixed(2),
        status: c.status,
        lastActivityAt: c.lastActivityAt,
        recoveryLink: c.recoveryLink,
        reminderSentAt: c.reminderSentAt,
        itemCount: items.length,
        items,
        customer: c.customer,
      };
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ABANDONED_CARTS_PAGE_SIZE)),
  };
}

export type AbandonedCartListRow = Awaited<ReturnType<typeof listAbandonedCarts>>["rows"][number];

export interface AbandonedCartStats {
  total: number;
  active: number;
  recovered: number;
  expired: number;
  recoveryRate: number;
  potentialRevenue: string;
  remindersSent: number;
}

export async function getAbandonedCartStats(): Promise<AbandonedCartStats> {
  const [total, active, recovered, expired, remindersSent, activeAgg] = await Promise.all([
    prisma.abandonedCart.count(),
    prisma.abandonedCart.count({ where: { status: "ACTIVE" } }),
    prisma.abandonedCart.count({ where: { status: "RECOVERED" } }),
    prisma.abandonedCart.count({ where: { status: "EXPIRED" } }),
    prisma.abandonedCart.count({ where: { reminderSentAt: { not: null } } }),
    prisma.abandonedCart.aggregate({ where: { status: "ACTIVE" }, _sum: { subtotal: true } }),
  ]);

  const closed = recovered + expired;
  const recoveryRate = closed > 0 ? Math.round((recovered / closed) * 100) : 0;

  return {
    total,
    active,
    recovered,
    expired,
    recoveryRate,
    potentialRevenue: (activeAgg._sum.subtotal ?? 0).toString(),
    remindersSent,
  };
}
