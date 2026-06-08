import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/money";
import { type DateRange, resolveRange, DATA_RANGE_START, DATA_RANGE_END } from "@/lib/queries/overview";

export { resolveRange, DATA_RANGE_START, DATA_RANGE_END };
export type { DateRange };

const FULFILLED_STATUSES = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

function rangeWhere(range: DateRange): Prisma.OrderWhereInput {
  return { placedAt: { gte: range.from, lt: range.to } };
}

// ── Revenue trend (monthly) ─────────────────────────────────────

export interface RevenueTrendPoint {
  month: string;
  revenue: string;
  orders: number;
}

export async function getRevenueTrend(range: DateRange): Promise<RevenueTrendPoint[]> {
  const orders = await prisma.order.findMany({
    where: { ...rangeWhere(range), status: { not: "CANCELLED" } },
    select: { placedAt: true, total: true },
  });

  const buckets = new Map<string, { revenue: Prisma.Decimal; orders: number }>();
  for (const o of orders) {
    const key = `${o.placedAt.getUTCFullYear()}-${String(o.placedAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key) ?? { revenue: new Prisma.Decimal(0), orders: 0 };
    bucket.revenue = bucket.revenue.add(o.total);
    bucket.orders += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({ month, revenue: round2(b.revenue).toFixed(2), orders: b.orders }));
}

// ── Conversion & traffic proxy ──────────────────────────────────

export interface ConversionStats {
  orderCount: number;
  convertedCount: number;
  conversionRate: number;
  customerCount: number;
  trafficToOrderRatio: number;
}

export async function getConversionStats(range: DateRange): Promise<ConversionStats> {
  const where = rangeWhere(range);
  const [orderCount, convertedCount, customerCount] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, status: { in: [...FULFILLED_STATUSES] } } }),
    prisma.customer.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
  ]);

  const conversionRate = orderCount > 0 ? convertedCount / orderCount : 0;
  // Proxy: registered customers in the window vs. orders placed — a stand-in
  // for "site visits → completed order" since no traffic/analytics events
  // are tracked in this schema.
  const trafficToOrderRatio = customerCount > 0 ? orderCount / customerCount : 0;

  return { orderCount, convertedCount, conversionRate, customerCount, trafficToOrderRatio };
}

// ── Top products ────────────────────────────────────────────────

export interface PerformanceTopProduct {
  productId: string;
  nameEn: string;
  nameAr: string;
  brand: string;
  unitsSold: number;
  revenue: string;
  avgRating: number | null;
  reviewCount: number;
}

export async function getTopPerformingProducts(range: DateRange, limit = 10): Promise<PerformanceTopProduct[]> {
  const items = await prisma.orderItem.findMany({
    where: { order: { ...rangeWhere(range), status: { not: "CANCELLED" } } },
    select: {
      quantity: true,
      lineTotal: true,
      variant: {
        select: {
          product: {
            select: { id: true, nameEn: true, nameAr: true, brand: true },
          },
        },
      },
    },
  });

  const byProduct = new Map<
    string,
    { nameEn: string; nameAr: string; brand: string; units: number; revenue: Prisma.Decimal }
  >();
  for (const item of items) {
    const p = item.variant.product;
    const entry = byProduct.get(p.id) ?? { nameEn: p.nameEn, nameAr: p.nameAr, brand: p.brand, units: 0, revenue: new Prisma.Decimal(0) };
    entry.units += item.quantity;
    entry.revenue = entry.revenue.add(item.lineTotal);
    byProduct.set(p.id, entry);
  }

  const ranked = [...byProduct.entries()]
    .sort(([, a], [, b]) => b.revenue.comparedTo(a.revenue))
    .slice(0, limit);

  const reviewAggs = await prisma.review.groupBy({
    by: ["productId"],
    where: { productId: { in: ranked.map(([id]) => id) } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const reviewByProduct = new Map(reviewAggs.map((r) => [r.productId, r]));

  return ranked.map(([productId, entry]) => {
    const review = reviewByProduct.get(productId);
    return {
      productId,
      nameEn: entry.nameEn,
      nameAr: entry.nameAr,
      brand: entry.brand,
      unitsSold: entry.units,
      revenue: round2(entry.revenue).toFixed(2),
      avgRating: review?._avg.rating != null ? Math.round(review._avg.rating * 10) / 10 : null,
      reviewCount: review?._count._all ?? 0,
    };
  });
}

// ── Customer retention ──────────────────────────────────────────

export interface RetentionStats {
  totalCustomers: number;
  repeatCustomers: number;
  retentionRate: number;
  avgOrdersPerCustomer: number;
}

export async function getRetentionStats(range: DateRange): Promise<RetentionStats> {
  const grouped = await prisma.order.groupBy({
    by: ["customerId"],
    where: { ...rangeWhere(range), status: { not: "CANCELLED" } },
    _count: { _all: true },
  });

  const totalCustomers = grouped.length;
  const repeatCustomers = grouped.filter((g) => g._count._all > 1).length;
  const totalOrders = grouped.reduce((sum, g) => sum + g._count._all, 0);

  return {
    totalCustomers,
    repeatCustomers,
    retentionRate: totalCustomers > 0 ? repeatCustomers / totalCustomers : 0,
    avgOrdersPerCustomer: totalCustomers > 0 ? Math.round((totalOrders / totalCustomers) * 10) / 10 : 0,
  };
}

// ── KPI summary ─────────────────────────────────────────────────

export interface PerformanceKpis {
  revenue: string;
  orderCount: number;
  conversionRate: number;
  retentionRate: number;
  avgOrderValue: string;
}

export async function getPerformanceKpis(range: DateRange): Promise<PerformanceKpis> {
  const where = { ...rangeWhere(range), status: { not: "CANCELLED" as const } };
  const [agg, conversion, retention] = await Promise.all([
    prisma.order.aggregate({ where, _sum: { total: true }, _count: { _all: true } }),
    getConversionStats(range),
    getRetentionStats(range),
  ]);

  const revenue = agg._sum.total ?? new Prisma.Decimal(0);
  const orderCount = agg._count._all;
  const avgOrderValue = orderCount > 0 ? round2(revenue.div(orderCount)) : new Prisma.Decimal(0);

  return {
    revenue: round2(revenue).toFixed(2),
    orderCount,
    conversionRate: conversion.conversionRate,
    retentionRate: retention.retentionRate,
    avgOrderValue: avgOrderValue.toFixed(2),
  };
}
