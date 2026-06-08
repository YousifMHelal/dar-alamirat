import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const GIFT_CARDS_PAGE_SIZE = 15;

export type GiftCardStatus = "ACTIVE" | "REDEEMED" | "EXPIRED" | "DISABLED";

export interface GiftCardsFilter {
  search?: string;
  status?: GiftCardStatus;
  page: number;
}

function buildWhere(filter: GiftCardsFilter): Prisma.GiftCardWhereInput {
  const where: Prisma.GiftCardWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.search?.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { issuedTo: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function listGiftCards(filter: GiftCardsFilter) {
  const where = buildWhere(filter);
  const page = Math.max(1, filter.page);

  const [rows, total] = await Promise.all([
    prisma.giftCard.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * GIFT_CARDS_PAGE_SIZE,
      take: GIFT_CARDS_PAGE_SIZE,
      select: {
        id: true,
        code: true,
        initialValue: true,
        remainingBalance: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        issuedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.giftCard.count({ where }),
  ]);

  return {
    rows: rows.map((g) => ({
      id: g.id,
      code: g.code,
      initialValue: g.initialValue.toFixed(2),
      remainingBalance: g.remainingBalance.toFixed(2),
      status: g.status,
      expiresAt: g.expiresAt,
      createdAt: g.createdAt,
      issuedTo: g.issuedTo,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / GIFT_CARDS_PAGE_SIZE)),
  };
}

export type GiftCardListRow = Awaited<ReturnType<typeof listGiftCards>>["rows"][number];

export async function getGiftCardDetail(id: string) {
  const card = await prisma.giftCard.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      initialValue: true,
      remainingBalance: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      issuedTo: { select: { id: true, name: true, email: true, phone: true } },
      transactions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          type: true,
          createdAt: true,
          order: { select: { id: true, orderNumber: true } },
        },
      },
    },
  });
  if (!card) return null;

  return {
    id: card.id,
    code: card.code,
    initialValue: card.initialValue.toFixed(2),
    remainingBalance: card.remainingBalance.toFixed(2),
    status: card.status,
    expiresAt: card.expiresAt,
    createdAt: card.createdAt,
    issuedTo: card.issuedTo,
    transactions: card.transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount.toFixed(2),
      type: tx.type,
      createdAt: tx.createdAt,
      order: tx.order,
    })),
  };
}

export type GiftCardDetail = NonNullable<Awaited<ReturnType<typeof getGiftCardDetail>>>;

export interface GiftCardStats {
  total: number;
  active: number;
  outstandingBalance: string;
  redeemedThisMonth: number;
}

export async function getGiftCardStats(): Promise<GiftCardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, active, outstanding, redeemedThisMonth] = await Promise.all([
    prisma.giftCard.count(),
    prisma.giftCard.count({ where: { status: "ACTIVE" } }),
    prisma.giftCard.aggregate({ where: { status: "ACTIVE" }, _sum: { remainingBalance: true } }),
    prisma.giftCardTransaction.count({
      where: { type: "REDEMPTION", createdAt: { gte: startOfMonth } },
    }),
  ]);

  return {
    total,
    active,
    outstandingBalance: (outstanding._sum.remainingBalance ?? new Prisma.Decimal(0)).toFixed(2),
    redeemedThisMonth,
  };
}

export async function listCustomersForSelect() {
  return prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true },
    take: 100,
  });
}
