import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read-side data access for the Inventory module. Pure queries returning
 * plain shapes for the Server Components. The headline read is the STOCK
 * MATRIX: one row per variant, one cell per warehouse, so the operator sees
 * the whole grid (variants × the 4 warehouses) at a glance.
 */

export const INVENTORY_PAGE_SIZE = 15;

export interface InventoryFilter {
  /** Free-text: variant SKU, barcode, product name (ar/en), or brand. */
  search?: string;
  warehouseId?: string; // restrict the "low stock only" check to one warehouse
  lowStockOnly?: boolean;
  page: number;
}

export interface WarehouseColumn {
  id: string;
  name: string;
  code: string;
  city: string;
}

export interface StockCell {
  warehouseId: string;
  inventoryItemId: string | null; // null if no row exists for this pair
  quantityOnHand: number;
  reorderLevel: number;
  /** quantityOnHand < reorderLevel (and a row exists). */
  low: boolean;
}

export interface StockRow {
  variantId: string;
  variantSku: string;
  barcode: string | null;
  colorName: string | null;
  colorHex: string | null;
  capacity: string | null;
  productName: { en: string; ar: string };
  brand: string;
  /** One cell per warehouse column, in column order. */
  cells: StockCell[];
  /** Sum across warehouses. */
  totalStock: number;
  /** True if any cell is low. */
  anyLow: boolean;
}

export interface WarehouseRow extends WarehouseColumn {
  _count: { inventoryItems: number };
  createdAt: Date;
}

/** The 4 warehouses, in a stable display order. */
export async function listWarehouses(): Promise<WarehouseColumn[]> {
  return prisma.warehouse.findMany({
    orderBy: { code: "asc" },
    select: { id: true, name: true, code: true, city: true },
  });
}

/** Full warehouse rows for the management panel. */
export async function listWarehousesFull(): Promise<WarehouseRow[]> {
  return prisma.warehouse.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      city: true,
      createdAt: true,
      _count: { select: { inventoryItems: true } },
    },
  });
}

/**
 * Build the stock matrix for a page of variants. Returns the warehouse
 * columns plus one row per variant with a dense cell array (a cell for every
 * warehouse, even when no InventoryItem row exists for that pair yet).
 */
export async function getStockMatrix(filter: InventoryFilter) {
  const warehouses = await listWarehouses();
  const page = Math.max(1, filter.page);

  const variantWhere: Prisma.ProductVariantWhereInput = {};
  if (filter.search?.trim()) {
    const q = filter.search.trim();
    variantWhere.OR = [
      { variantSku: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q } },
      { product: { nameEn: { contains: q, mode: "insensitive" } } },
      { product: { nameAr: { contains: q } } },
      { product: { brand: { contains: q, mode: "insensitive" } } },
    ];
  }
  // "Low stock only": the variant must have at least one inventory row below
  // its reorder level (optionally scoped to one warehouse).
  if (filter.lowStockOnly) {
    variantWhere.inventoryItems = {
      some: {
        ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        quantityOnHand: { lt: prisma.inventoryItem.fields.reorderLevel },
      },
    };
  }

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where: variantWhere,
      orderBy: { variantSku: "asc" },
      skip: (page - 1) * INVENTORY_PAGE_SIZE,
      take: INVENTORY_PAGE_SIZE,
      select: {
        id: true,
        variantSku: true,
        barcode: true,
        colorName: true,
        colorHex: true,
        capacity: true,
        product: { select: { nameEn: true, nameAr: true, brand: true } },
        inventoryItems: {
          select: { id: true, warehouseId: true, quantityOnHand: true, reorderLevel: true },
        },
      },
    }),
    prisma.productVariant.count({ where: variantWhere }),
  ]);

  const rows: StockRow[] = variants.map((v) => {
    const byWarehouse = new Map(v.inventoryItems.map((i) => [i.warehouseId, i]));
    const cells: StockCell[] = warehouses.map((w) => {
      const item = byWarehouse.get(w.id);
      const quantityOnHand = item?.quantityOnHand ?? 0;
      const reorderLevel = item?.reorderLevel ?? 0;
      return {
        warehouseId: w.id,
        inventoryItemId: item?.id ?? null,
        quantityOnHand,
        reorderLevel,
        low: Boolean(item) && quantityOnHand < reorderLevel,
      };
    });
    return {
      variantId: v.id,
      variantSku: v.variantSku,
      barcode: v.barcode,
      colorName: v.colorName,
      colorHex: v.colorHex,
      capacity: v.capacity,
      productName: { en: v.product.nameEn, ar: v.product.nameAr },
      brand: v.product.brand,
      cells,
      totalStock: cells.reduce((s, c) => s + c.quantityOnHand, 0),
      anyLow: cells.some((c) => c.low),
    };
  });

  return {
    warehouses,
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE)),
  };
}

export type StockMatrixResult = Awaited<ReturnType<typeof getStockMatrix>>;

/** Count of low-stock cells across the whole catalog (for the KPI strip). */
export async function countLowStock(warehouseId?: string): Promise<number> {
  return prisma.inventoryItem.count({
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      quantityOnHand: { lt: prisma.inventoryItem.fields.reorderLevel },
    },
  });
}

// ── Stock transfers ────────────────────────────────────────────

export async function listTransfers(limit = 30) {
  const rows = await prisma.stockTransfer.findMany({
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      quantity: true,
      status: true,
      date: true,
      fromWarehouse: { select: { name: true, code: true } },
      toWarehouse: { select: { name: true, code: true } },
      variant: {
        select: {
          variantSku: true,
          capacity: true,
          colorName: true,
          product: { select: { nameEn: true, nameAr: true, brand: true } },
        },
      },
    },
  });
  return rows;
}

export type TransferRow = Awaited<ReturnType<typeof listTransfers>>[number];

/**
 * The select shape used by the "create transfer" variant picker. The picker
 * lives in a client component, so the actual query is a server action in
 * actions.ts; this exported type lets both sides agree on the shape without
 * the client importing anything Prisma-backed from this module.
 */
export interface TransferVariantOption {
  id: string;
  variantSku: string;
  capacity: string | null;
  colorName: string | null;
  product: { nameEn: string; nameAr: string; brand: string };
  inventoryItems: { warehouseId: string; quantityOnHand: number }[];
}

// ── Purchase orders (basic inbound procurement log) ────────────

export interface PurchaseOrderLine {
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export async function listPurchaseOrders(limit = 30) {
  const rows = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      poNumber: true,
      supplier: true,
      status: true,
      total: true,
      expectedAt: true,
      items: true,
      warehouse: { select: { name: true, code: true } },
    },
  });
  return rows.map((po) => {
    const items = (po.items as unknown as PurchaseOrderLine[]) ?? [];
    return {
      id: po.id,
      poNumber: po.poNumber,
      supplier: po.supplier,
      status: po.status,
      total: po.total.toFixed(2),
      expectedAt: po.expectedAt,
      warehouse: po.warehouse,
      lineCount: items.length,
      unitCount: items.reduce((s, l) => s + (l.quantity ?? 0), 0),
    };
  });
}

export type PurchaseOrderRow = Awaited<ReturnType<typeof listPurchaseOrders>>[number];
