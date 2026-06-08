import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const CUSTOMERS_PAGE_SIZE = 15;

export interface CustomersFilter {
  search?: string;
  type?: "RETAIL" | "B2B_SALON";
  page: number;
}

function buildWhere(filter: CustomersFilter): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};
  if (filter.type) where.type = filter.type;
  if (filter.search?.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listCustomers(filter: CustomersFilter) {
  const where = buildWhere(filter);
  const page = Math.max(1, filter.page);

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * CUSTOMERS_PAGE_SIZE,
      take: CUSTOMERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        type: true,
        city: true,
        loyaltyPoints: true,
        pricingTier: { select: { id: true, name: true } },
        creditAccount: {
          select: { creditLimit: true, balance: true },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    rows: rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      type: c.type,
      city: c.city,
      loyaltyPoints: c.loyaltyPoints,
      pricingTier: c.pricingTier,
      creditLimit: c.creditAccount?.creditLimit.toFixed(2) ?? null,
      creditBalance: c.creditAccount?.balance.toFixed(2) ?? null,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE)),
  };
}

export type CustomerListRow = Awaited<ReturnType<typeof listCustomers>>["rows"][number];

export async function getCustomerDetail(id: string) {
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      type: true,
      city: true,
      addressLine: true,
      crmNotes: true,
      loyaltyPoints: true,
      createdAt: true,
      pricingTier: { select: { id: true, name: true } },
      creditAccount: {
        select: {
          id: true,
          creditLimit: true,
          balance: true,
          transactions: {
            orderBy: { date: "desc" },
            take: 20,
            select: {
              id: true,
              type: true,
              amount: true,
              note: true,
              date: true,
            },
          },
        },
      },
      orders: {
        orderBy: { placedAt: "desc" },
        take: 20,
        select: {
          id: true,
          orderNumber: true,
          type: true,
          status: true,
          total: true,
          placedAt: true,
        },
      },
    },
  });

  if (!c) return null;

  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    type: c.type,
    city: c.city,
    addressLine: c.addressLine,
    crmNotes: c.crmNotes,
    loyaltyPoints: c.loyaltyPoints,
    createdAt: c.createdAt,
    pricingTier: c.pricingTier,
    creditAccount: c.creditAccount
      ? {
          id: c.creditAccount.id,
          creditLimit: c.creditAccount.creditLimit.toFixed(2),
          balance: c.creditAccount.balance.toFixed(2),
          transactions: c.creditAccount.transactions.map((tx) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount.toFixed(2),
            note: tx.note,
            date: tx.date,
          })),
        }
      : null,
    orders: c.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      type: o.type,
      status: o.status,
      total: o.total.toFixed(2),
      placedAt: o.placedAt,
    })),
  };
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomerDetail>>>;
