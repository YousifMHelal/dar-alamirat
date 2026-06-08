import { z } from "zod";

/**
 * Zod schemas for Inventory mutations — authoritative on the server,
 * mirrored by the client. Quantities are non-negative integers.
 */

export const updateStockSchema = z.object({
  variantId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  quantityOnHand: z.number().int().min(0, "quantityMin"),
  reorderLevel: z.number().int().min(0, "reorderMin"),
});

export const createTransferSchema = z
  .object({
    variantId: z.string().cuid(),
    fromWarehouseId: z.string().cuid(),
    toWarehouseId: z.string().cuid(),
    quantity: z.number().int().min(1, "quantityMin"),
    // Initial status — COMPLETED moves stock immediately.
    status: z.enum(["PENDING", "IN_TRANSIT", "COMPLETED"]),
  })
  .refine((d) => d.fromWarehouseId !== d.toWarehouseId, {
    message: "sameWarehouse",
    path: ["toWarehouseId"],
  });

export const updateTransferStatusSchema = z.object({
  transferId: z.string().cuid(),
  status: z.enum(["PENDING", "IN_TRANSIT", "COMPLETED"]),
});

export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type UpdateTransferStatusInput = z.infer<typeof updateTransferStatusSchema>;
