import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const COUPONS_PAGE_SIZE = 15;

export interface CouponsFilter {
  search?: string;
  status?: "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DISABLED";
  page: number;
}

function buildWhere(filter: CouponsFilter): Prisma.CouponWhereInput {
  const where: Prisma.CouponWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.search?.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listCoupons(filter: CouponsFilter) {
  const where = buildWhere(filter);
  const page = Math.max(1, filter.page);

  const [rows, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * COUPONS_PAGE_SIZE,
      take: COUPONS_PAGE_SIZE,
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        minOrder: true,
        usageLimit: true,
        usageCount: true,
        startsAt: true,
        endsAt: true,
        status: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.coupon.count({ where }),
  ]);

  return {
    rows: rows.map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value.toFixed(2),
      minOrder: c.minOrder?.toFixed(2) ?? null,
      usageLimit: c.usageLimit,
      usageCount: c.usageCount,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      status: c.status,
      orderCount: c._count.orders,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / COUPONS_PAGE_SIZE)),
  };
}

export type CouponListRow = Awaited<ReturnType<typeof listCoupons>>["rows"][number];

/** Format a Date for a `datetime-local` input (local time, minute precision). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function getCouponDetail(id: string) {
  const c = await prisma.coupon.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      description: true,
      type: true,
      value: true,
      minOrder: true,
      usageLimit: true,
      startsAt: true,
      endsAt: true,
      status: true,
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    code: c.code,
    description: c.description ?? "",
    type: c.type,
    value: c.value.toString(),
    minOrder: c.minOrder?.toString() ?? "",
    usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
    startsAt: toLocalInput(c.startsAt),
    endsAt: c.endsAt ? toLocalInput(c.endsAt) : "",
    status: c.status,
  };
}

export type CouponDetail = NonNullable<Awaited<ReturnType<typeof getCouponDetail>>>;

export interface CouponStats {
  total: number;
  active: number;
  scheduled: number;
  expired: number;
  disabled: number;
  totalRedemptions: number;
  totalDiscountedOrders: number;
}

/** Aggregate counters for the summary cards atop the coupons page. */
export async function getCouponStats(): Promise<CouponStats> {
  const [total, active, scheduled, expired, disabled, usage, ordersWithCoupon] = await Promise.all([
    prisma.coupon.count(),
    prisma.coupon.count({ where: { status: "ACTIVE" } }),
    prisma.coupon.count({ where: { status: "SCHEDULED" } }),
    prisma.coupon.count({ where: { status: "EXPIRED" } }),
    prisma.coupon.count({ where: { status: "DISABLED" } }),
    prisma.coupon.aggregate({ _sum: { usageCount: true } }),
    prisma.order.count({ where: { couponId: { not: null } } }),
  ]);

  return {
    total,
    active,
    scheduled,
    expired,
    disabled,
    totalRedemptions: usage._sum.usageCount ?? 0,
    totalDiscountedOrders: ordersWithCoupon,
  };
}
