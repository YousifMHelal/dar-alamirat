"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import {
  createTransferSchema,
  updateStockSchema,
  updateTransferStatusSchema,
  type CreateTransferInput,
  type UpdateStockInput,
  type UpdateTransferStatusInput,
} from "./schema";
import type { TransferVariantOption } from "./queries";

/**
 * Variant search for the "create transfer" picker. Lives here (a server
 * action) rather than in queries.ts so the client picker can call it without
 * pulling Prisma into the browser bundle.
 */
export async function searchVariantsForTransfer(
  query: string,
): Promise<TransferVariantOption[]> {
  await requireUser();
  const q = query.trim();
  if (q.length < 2) return [];
  return prisma.productVariant.findMany({
    where: {
      OR: [
        { variantSku: { contains: q, mode: "insensitive" } },
        { product: { nameEn: { contains: q, mode: "insensitive" } } },
        { product: { nameAr: { contains: q } } },
        { product: { brand: { contains: q, mode: "insensitive" } } },
      ],
    },
    take: 15,
    select: {
      id: true,
      variantSku: true,
      capacity: true,
      colorName: true,
      product: { select: { nameEn: true, nameAr: true, brand: true } },
      inventoryItems: { select: { warehouseId: true, quantityOnHand: true } },
    },
  });
}

/**
 * Server actions for Inventory. Every mutation asserts auth, validates with
 * Zod, and returns a `{ ok }` union. Two real movements of stock are
 * modelled:
 *
 *   - editStock: set quantityOnHand / reorderLevel for a (variant, warehouse)
 *     cell, creating the InventoryItem row if it didn't exist yet (upsert).
 *   - transfers: creating or completing a transfer moves real units between
 *     warehouses (decrement source, increment destination) inside a
 *     transaction. Stock only moves on COMPLETED, exactly once.
 */

export type StockResult =
  | { ok: true; quantityOnHand: number; reorderLevel: number }
  | { ok: false; error: string };

export async function editStock(input: UpdateStockInput): Promise<StockResult> {
  await requireUser();
  const parsed = updateStockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const { variantId, warehouseId, quantityOnHand, reorderLevel } = parsed.data;

  try {
    const item = await prisma.inventoryItem.upsert({
      where: { warehouseId_variantId: { warehouseId, variantId } },
      update: { quantityOnHand, reorderLevel },
      create: { warehouseId, variantId, quantityOnHand, reorderLevel },
      select: { quantityOnHand: true, reorderLevel: true },
    });
    revalidatePath("/inventory");
    return { ok: true, quantityOnHand: item.quantityOnHand, reorderLevel: item.reorderLevel };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export type TransferResult = { ok: true; transferId: string } | { ok: false; error: string };

/**
 * Create a stock transfer. If created as COMPLETED, the units move
 * immediately (source must have enough on hand). PENDING/IN_TRANSIT create
 * the record without moving stock yet.
 */
export async function createTransfer(input: CreateTransferInput): Promise<TransferResult> {
  await requireUser();
  const parsed = createTransferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const { variantId, fromWarehouseId, toWarehouseId, quantity, status } = parsed.data;

  try {
    const transferId = await prisma.$transaction(async (tx) => {
      if (status === "COMPLETED") {
        await moveStock(tx, { variantId, fromWarehouseId, toWarehouseId, quantity });
      }
      const transfer = await tx.stockTransfer.create({
        data: { variantId, fromWarehouseId, toWarehouseId, quantity, status },
        select: { id: true },
      });
      return transfer.id;
    });
    revalidatePath("/inventory");
    return { ok: true, transferId };
  } catch (e) {
    if (e instanceof InsufficientStock) return { ok: false, error: "insufficientStock" };
    return { ok: false, error: "unknown" };
  }
}

/**
 * Advance a transfer's status. The actual stock movement happens exactly
 * once, on the transition INTO the COMPLETED state.
 */
export async function updateTransferStatus(
  input: UpdateTransferStatusInput,
): Promise<TransferResult> {
  await requireUser();
  const parsed = updateTransferStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const { transferId, status } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        select: {
          status: true,
          quantity: true,
          variantId: true,
          fromWarehouseId: true,
          toWarehouseId: true,
        },
      });
      if (!transfer) throw new NotFound();

      // Move stock only when crossing from a non-completed state to COMPLETED.
      if (status === "COMPLETED" && transfer.status !== "COMPLETED") {
        await moveStock(tx, {
          variantId: transfer.variantId,
          fromWarehouseId: transfer.fromWarehouseId,
          toWarehouseId: transfer.toWarehouseId,
          quantity: transfer.quantity,
        });
      }
      await tx.stockTransfer.update({ where: { id: transferId }, data: { status } });
    });
    revalidatePath("/inventory");
    return { ok: true, transferId };
  } catch (e) {
    if (e instanceof InsufficientStock) return { ok: false, error: "insufficientStock" };
    if (e instanceof NotFound) return { ok: false, error: "notFound" };
    return { ok: false, error: "unknown" };
  }
}

// ── helpers ────────────────────────────────────────────────────

/**
 * Move `quantity` units of a variant from one warehouse to another inside an
 * existing transaction: decrement the source (verifying it has enough) and
 * increment the destination (creating its row if needed).
 */
async function moveStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  args: { variantId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number },
) {
  const { variantId, fromWarehouseId, toWarehouseId, quantity } = args;

  const source = await tx.inventoryItem.findUnique({
    where: { warehouseId_variantId: { warehouseId: fromWarehouseId, variantId } },
    select: { quantityOnHand: true },
  });
  if (!source || source.quantityOnHand < quantity) {
    throw new InsufficientStock();
  }

  await tx.inventoryItem.update({
    where: { warehouseId_variantId: { warehouseId: fromWarehouseId, variantId } },
    data: { quantityOnHand: { decrement: quantity } },
  });

  await tx.inventoryItem.upsert({
    where: { warehouseId_variantId: { warehouseId: toWarehouseId, variantId } },
    update: { quantityOnHand: { increment: quantity } },
    create: { warehouseId: toWarehouseId, variantId, quantityOnHand: quantity, reorderLevel: 0 },
  });
}

class InsufficientStock extends Error {}
class NotFound extends Error {}
