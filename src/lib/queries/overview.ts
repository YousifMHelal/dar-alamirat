import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read-side aggregation queries for the Overview / BI module.
 *
 * Every number here is computed from the REAL seeded tables — no mocked
 * figures. Conventions that keep the dashboard honest and reconcilable:
 *
 *   - Money math stays in Prisma.Decimal until the boundary, then is
 *     serialised to a plain number string for the client charts.
 *   - CANCELLED orders are excluded from revenue sums (they earned
 *     nothing) but still counted in the raw "orders placed" KPI, because
 *     both views are operationally meaningful.
 *   - There is no COGS column in the schema, so "net margin" is defined
 *     concretely as net revenue (ex-VAT subtotal) minus payment-gateway
 *     fees — the only real cost the data carries. This is auditable and
 *     reconciles against the Payment.gatewayFee column.
 *   - "Conversion proxy": the share of placed orders that reached a
 *     fulfilled/paid state (CONFIRMED..DELIVERED), a defensible proxy for
 *     funnel completion given the seeded order lifecycle.
 *
 * The date range filters on Order.placedAt as a half-open interval
 * [from, to). All chart/category/product aggregates respect the same
 * window so the dashboard re-queries coherently when the range changes.
 */

/** Full span of seeded order history — the default dashboard window. */
export const DATA_RANGE_START = new Date("2026-01-01T00:00:00.000Z");
export const DATA_RANGE_END = new Date("2026-06-01T00:00:00.000Z");

export interface DateRange {
  from: Date;
  to: Date; // exclusive upper bound
}

/** Clamp a requested range to the seeded data span and guarantee from < to. */
export function resolveRange(from?: Date, to?: Date): DateRange {
  const start = from && !Number.isNaN(from.getTime()) ? from : DATA_RANGE_START;
  // `to` is treated as inclusive at the day level by the caller; we keep it
  // as an exclusive bound here.
  const end = to && !Number.isNaN(to.getTime()) ? to : DATA_RANGE_END;
  return start < end ? { from: start, to: end } : { from: DATA_RANGE_START, to: DATA_RANGE_END };
}

/** Orders inside the window. Reused by every aggregate below. */
function rangeWhere(range: DateRange): Prisma.OrderWhereInput {
  return { placedAt: { gte: range.from, lt: range.to } };
}

// ── KPI summary ────────────────────────────────────────────────

export interface OverviewKpis {
  /** VAT-inclusive revenue from non-cancelled orders. */
  grossSales: string;
  /** Ex-VAT revenue (subtotal) from non-cancelled orders. */
  netSales: string;
  /** VAT collected. */
  vatCollected: string;
  /** Net revenue minus gateway fees — the auditable "margin" figure. */
  netMargin: string;
  /** netMargin / grossSales as a 0..1 fraction (0 when no sales). */
  netMarginRate: number;
  /** Total orders placed in the window (includes cancelled). */
  orderCount: number;
  /** Orders that reached a fulfilled/paid state. */
  convertedCount: number;
  /** convertedCount / orderCount as a 0..1 fraction. */
  conversionProxy: number;
  /** Average order value (gross) over non-cancelled orders. */
  avgOrderValue: string;
  b2b: { orders: number; sales: string };
  b2c: { orders: number; sales: string };
}

export async function getOverviewKpis(range: DateRange): Promise<OverviewKpis> {
  const where = rangeWhere(range);
  const nonCancelled: Prisma.OrderWhereInput = { ...where, status: { not: "CANCELLED" } };
  // CONFIRMED..DELIVERED = the order made it past the funnel; PENDING and
  // CANCELLED do not count as conversions.
  const converted: Prisma.OrderWhereInput = {
    ...where,
    status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
  };

  const [revenue, orderCount, convertedCount, byType, feeAgg, salesCount] = await Promise.all([
    prisma.order.aggregate({
      where: nonCancelled,
      _sum: { total: true, subtotal: true, vatAmount: true },
    }),
    prisma.order.count({ where }),
    prisma.order.count({ where: converted }),
    prisma.order.groupBy({
      by: ["type"],
      where: nonCancelled,
      _sum: { total: true },
      _count: true,
    }),
    // Gateway fees attach to payments; restrict to payments whose order is
    // in-window and non-cancelled.
    prisma.payment.aggregate({
      where: { order: nonCancelled },
      _sum: { gatewayFee: true },
    }),
    prisma.order.count({ where: nonCancelled }),
  ]);

  const gross = revenue._sum.total ?? new Prisma.Decimal(0);
  const net = revenue._sum.subtotal ?? new Prisma.Decimal(0);
  const vat = revenue._sum.vatAmount ?? new Prisma.Decimal(0);
  const fees = feeAgg._sum.gatewayFee ?? new Prisma.Decimal(0);
  const netMargin = net.sub(fees);
  const netMarginRate = gross.gt(0) ? netMargin.div(gross).toNumber() : 0;
  const avg = salesCount > 0 ? gross.div(salesCount) : new Prisma.Decimal(0);

  const findType = (t: "WHOLESALE" | "RETAIL") => byType.find((r) => r.type === t);
  const wholesale = findType("WHOLESALE");
  const retail = findType("RETAIL");

  return {
    grossSales: gross.toFixed(2),
    netSales: net.toFixed(2),
    vatCollected: vat.toFixed(2),
    netMargin: netMargin.toFixed(2),
    netMarginRate,
    orderCount,
    convertedCount,
    conversionProxy: orderCount > 0 ? convertedCount / orderCount : 0,
    avgOrderValue: avg.toFixed(2),
    b2b: { orders: wholesale?._count ?? 0, sales: (wholesale?._sum.total ?? new Prisma.Decimal(0)).toFixed(2) },
    b2c: { orders: retail?._count ?? 0, sales: (retail?._sum.total ?? new Prisma.Decimal(0)).toFixed(2) },
  };
}

// ── Sales over time (monthly buckets) ──────────────────────────

export interface SalesPoint {
  /** ISO month start, e.g. "2026-03-01". */
  month: string;
  retail: string;
  wholesale: string;
  total: string;
}

/**
 * Monthly gross sales split by order type. Uses a raw query because the
 * month bucketing (date_trunc) and conditional pivot are awkward in the
 * Prisma query API. Cancelled orders are excluded; the result is dense
 * for the requested range so the line chart has no gaps.
 */
export async function getSalesOverTime(range: DateRange): Promise<SalesPoint[]> {
  const rows = await prisma.$queryRaw<
    { month: Date; type: string; total: Prisma.Decimal }[]
  >`
    SELECT date_trunc('month', "placedAt") AS month,
           "type",
           SUM("total") AS total
    FROM "Order"
    WHERE "placedAt" >= ${range.from}
      AND "placedAt" < ${range.to}
      AND "status" <> 'CANCELLED'
    GROUP BY 1, 2
    ORDER BY 1
  `;

  // Pivot (month, type) → { retail, wholesale } and densify the months so
  // the trend line is continuous even where a type had no sales.
  const byMonth = new Map<string, { retail: Prisma.Decimal; wholesale: Prisma.Decimal }>();
  for (const m of eachMonth(range)) {
    byMonth.set(m, { retail: new Prisma.Decimal(0), wholesale: new Prisma.Decimal(0) });
  }
  for (const r of rows) {
    const key = monthKey(r.month);
    const bucket = byMonth.get(key);
    if (!bucket) continue;
    if (r.type === "WHOLESALE") bucket.wholesale = bucket.wholesale.add(r.total);
    else bucket.retail = bucket.retail.add(r.total);
  }

  return [...byMonth.entries()].map(([month, v]) => ({
    month,
    retail: v.retail.toFixed(2),
    wholesale: v.wholesale.toFixed(2),
    total: v.retail.add(v.wholesale).toFixed(2),
  }));
}

// ── Sales by category ──────────────────────────────────────────

export interface CategorySales {
  categoryId: string;
  nameEn: string;
  nameAr: string;
  sales: string;
  units: number;
}

/**
 * Gross sales and units per catalog category, descending by sales. Joins
 * OrderItem → variant → product → category, so this is the true revenue
 * attribution rather than an order-level approximation. Line totals are
 * ex-VAT (OrderItem.lineTotal), matching the catalog's pricing.
 */
export async function getSalesByCategory(range: DateRange): Promise<CategorySales[]> {
  return prisma.$queryRaw<CategorySales[]>`
    SELECT c."id"      AS "categoryId",
           c."nameEn"  AS "nameEn",
           c."nameAr"  AS "nameAr",
           SUM(oi."lineTotal")::numeric(14,2) AS "sales",
           SUM(oi."quantity")::int            AS "units"
    FROM "OrderItem" oi
    JOIN "Order" o            ON o."id" = oi."orderId"
    JOIN "ProductVariant" pv  ON pv."id" = oi."variantId"
    JOIN "Product" p          ON p."id" = pv."productId"
    JOIN "Category" c         ON c."id" = p."categoryId"
    WHERE o."placedAt" >= ${range.from}
      AND o."placedAt" < ${range.to}
      AND o."status" <> 'CANCELLED'
    GROUP BY c."id", c."nameEn", c."nameAr"
    ORDER BY "sales" DESC
  `.then((rows) =>
    rows.map((r) => ({ ...r, sales: Number(r.sales).toFixed(2), units: Number(r.units) })),
  );
}

// ── Top products ───────────────────────────────────────────────

export interface TopProduct {
  productId: string;
  nameEn: string;
  nameAr: string;
  brand: string;
  sales: string;
  units: number;
}

export async function getTopProducts(range: DateRange, limit = 8): Promise<TopProduct[]> {
  return prisma.$queryRaw<TopProduct[]>`
    SELECT p."id"     AS "productId",
           p."nameEn" AS "nameEn",
           p."nameAr" AS "nameAr",
           p."brand"  AS "brand",
           SUM(oi."lineTotal")::numeric(14,2) AS "sales",
           SUM(oi."quantity")::int            AS "units"
    FROM "OrderItem" oi
    JOIN "Order" o           ON o."id" = oi."orderId"
    JOIN "ProductVariant" pv ON pv."id" = oi."variantId"
    JOIN "Product" p         ON p."id" = pv."productId"
    WHERE o."placedAt" >= ${range.from}
      AND o."placedAt" < ${range.to}
      AND o."status" <> 'CANCELLED'
    GROUP BY p."id", p."nameEn", p."nameAr", p."brand"
    ORDER BY "sales" DESC
    LIMIT ${limit}
  `.then((rows) =>
    rows.map((r) => ({ ...r, sales: Number(r.sales).toFixed(2), units: Number(r.units) })),
  );
}

// ── Mobile-app sync status ─────────────────────────────────────

export interface MobileSyncRow {
  platform: string;
  appVersion: string;
  status: "healthy" | "degraded" | "offline";
  lastSyncAt: string;
  pendingPushes: number;
  syncedEntities: { products: number; inventory: number; orders: number };
}

/**
 * Read the iOS/Android storefront sync status from the Setting table
 * (keys mobile_sync_ios / mobile_sync_android, written by the seed). Real
 * rows from the DB — the panel just renders whatever is stored.
 */
export async function getMobileSyncStatus(): Promise<MobileSyncRow[]> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["mobile_sync_ios", "mobile_sync_android"] } },
    select: { valueJson: true },
  });
  return rows
    .map((r) => r.valueJson as unknown as MobileSyncRow)
    .filter((r) => r && r.platform)
    .sort((a, b) => a.platform.localeCompare(b.platform));
}

// ── helpers ────────────────────────────────────────────────────

/** "2026-03-01" key from a Date (UTC month start). */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Every month-start key from range.from up to (not including) range.to. */
function eachMonth(range: DateRange): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), 1));
  while (cursor < range.to) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}
