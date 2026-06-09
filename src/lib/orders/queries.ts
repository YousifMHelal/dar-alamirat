import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, OrderType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Read-side data access for the Orders module. Pure queries — no
 * mutations, no auth (the page-level RBAC guard handles that). Everything
 * returns plain shapes the Server Components can render directly.
 */

export const ORDERS_PAGE_SIZE = 12;

export interface OrdersFilter {
  /** Free-text: matches orderNumber or customer name (case-insensitive). */
  search?: string;
  status?: OrderStatus;
  type?: OrderType;
  page: number;
}

/** Build the Prisma where-clause from the active filters. */
function buildWhere(filter: OrdersFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.type) where.type = filter.type;
  if (filter.search?.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
    ];
  }
  return where;
}

export async function listOrders(filter: OrdersFilter) {
  const where = buildWhere(filter);
  const page = Math.max(1, filter.page);

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        type: true,
        status: true,
        total: true,
        vatAmount: true,
        placedAt: true,
        customer: { select: { name: true, city: true, type: true } },
        assignedWarehouse: { select: { name: true, code: true, city: true } },
        _count: { select: { shipments: true, items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
  };
}

export type OrderListRow = Awaited<ReturnType<typeof listOrders>>["rows"][number];

/** Full order detail for the order detail page. */
export async function getOrderDetail(id: string) {
  return prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      type: true,
      status: true,
      subtotal: true,
      vatAmount: true,
      total: true,
      placedAt: true,
      customer: {
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
          pricingTier: { select: { name: true } },
        },
      },
      assignedWarehouse: { select: { name: true, code: true, city: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          variant: {
            select: {
              id: true,
              variantSku: true,
              colorName: true,
              colorHex: true,
              capacity: true,
              product: { select: { nameEn: true, nameAr: true, brand: true } },
            },
          },
        },
      },
      shipments: {
        select: {
          id: true,
          carrier: true,
          waybillNumber: true,
          status: true,
          warehouse: { select: { id: true, name: true, code: true, city: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              orderItem: {
                select: {
                  id: true,
                  variantId: true,
                  variant: {
                    select: {
                      variantSku: true,
                      colorName: true,
                      colorHex: true,
                      product: { select: { nameEn: true, nameAr: true, brand: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          method: true,
          amount: true,
          status: true,
          gatewayFee: true,
          settledAt: true,
        },
      },
    },
  });
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

/** Distinct status/type values for filter dropdowns are enum-driven, so no
 * query is needed — kept here as a reminder that filters come from enums. */

/**
 * Load the cached ZATCA result for a single order from the Settings table.
 * Returns null if no invoice has been generated yet.
 */
export async function getOrderZatcaStatus(orderNumber: string) {
  const row = await prisma.setting.findUnique({
    where: { key: `zatca.qr.${orderNumber}` },
    select: { valueJson: true, updatedAt: true },
  });
  if (!row) return null;
  const v = row.valueJson as { qrCode?: string; xml?: string; submissionStatus?: string } | null;
  return {
    qrCode: v?.qrCode ?? null,
    xml: v?.xml ?? null,
    submissionStatus: v?.submissionStatus ?? null,
    updatedAt: row.updatedAt,
  };
}

export type OrderZatcaStatus = Awaited<ReturnType<typeof getOrderZatcaStatus>>;

/**
 * For the orders list: fetch just the setting keys that exist so we can mark
 * which orders have had an e-invoice issued.  Returns a Set of orderNumbers.
 */
export async function getIssuedInvoiceOrderNumbers(orderNumbers: string[]): Promise<Set<string>> {
  if (orderNumbers.length === 0) return new Set();
  const keys = orderNumbers.map((n) => `zatca.qr.${n}`);
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true, valueJson: true },
  });
  const result = new Set<string>();
  for (const row of rows) {
    const orderNumber = row.key.replace("zatca.qr.", "");
    result.add(orderNumber);
  }
  return result;
}
