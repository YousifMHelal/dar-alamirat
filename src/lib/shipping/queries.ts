import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const SHIPPING_PAGE_SIZE = 15;

export interface ShippingFilter {
  carrier?: "ARAMEX" | "SMSA" | "SPL";
  status?: "PENDING" | "IN_TRANSIT" | "DELIVERED" | "RETURNED";
  page: number;
}

function buildWhere(filter: ShippingFilter): Prisma.ShipmentWhereInput {
  const where: Prisma.ShipmentWhereInput = {};
  if (filter.carrier) where.carrier = filter.carrier;
  if (filter.status) where.status = filter.status;
  return where;
}

export async function listShipments(filter: ShippingFilter) {
  const where = buildWhere(filter);
  const page = Math.max(1, filter.page);

  const [rows, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * SHIPPING_PAGE_SIZE,
      take: SHIPPING_PAGE_SIZE,
      select: {
        id: true,
        carrier: true,
        waybillNumber: true,
        status: true,
        createdAt: true,
        order: { select: { id: true, orderNumber: true } },
        warehouse: { select: { id: true, name: true, city: true } },
      },
    }),
    prisma.shipment.count({ where }),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / SHIPPING_PAGE_SIZE)),
  };
}

export type ShipmentListRow = Awaited<ReturnType<typeof listShipments>>["rows"][number];

export async function listWarehouses() {
  return prisma.warehouse.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      city: true,
      _count: { select: { shipments: true, inventoryItems: true } },
    },
  });
}

export type WarehouseSummary = Awaited<ReturnType<typeof listWarehouses>>[number];
