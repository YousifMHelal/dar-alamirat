import { z } from "zod";

/**
 * Zod schemas for Catalog mutations — authoritative on the server and
 * mirrored by the client form. Money fields arrive as strings from the
 * form (so the user's decimal input is preserved) and are validated as
 * non-negative decimals; the action converts them to Prisma.Decimal.
 */

/** A money string like "129.99" — up to 2 dp, non-negative. */
const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "priceInvalid")
  .refine((v) => Number(v) >= 0, "priceInvalid");

/** Optional money string (empty → null). */
const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "priceInvalid")
  .optional();

const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "hexInvalid");

export const variantSchema = z.object({
  // Present for existing variants (update), absent for new ones (create).
  id: z.string().cuid().optional(),
  colorName: z.string().trim().max(60).optional().or(z.literal("")),
  colorHex: hexColor.optional().or(z.literal("")),
  capacity: z.string().trim().max(40).optional().or(z.literal("")),
  variantSku: z.string().trim().min(1, "variantSkuRequired").max(60),
  barcode: z.string().trim().max(40).optional().or(z.literal("")),
  priceOverride: optionalMoney,
});

export const productSchema = z.object({
  nameAr: z.string().trim().min(2, "nameArRequired").max(200),
  nameEn: z.string().trim().min(2, "nameEnRequired").max(200),
  descriptionAr: z.string().trim().max(2000).optional().or(z.literal("")),
  descriptionEn: z.string().trim().max(2000).optional().or(z.literal("")),
  sku: z.string().trim().min(1, "skuRequired").max(60),
  brand: z.string().trim().min(1, "brandRequired").max(120),
  basePrice: moneyString,
  active: z.boolean(),
  categoryId: z.string().cuid("categoryRequired"),
  // At least one variant — a product with no sellable variant can't be ordered.
  variants: z.array(variantSchema).min(1, "variantRequired"),
});

export const updateProductSchema = productSchema.extend({
  id: z.string().cuid(),
});

/** One B2B tier price row (per product, per tier). */
export const tierPriceSchema = z.object({
  id: z.string().cuid().optional(),
  pricingTierId: z.string().cuid("tierRequired"),
  wholesalePrice: moneyString,
  moq: z.number().int().min(1, "moqMin"),
});

export const setTierPricesSchema = z.object({
  productId: z.string().cuid(),
  // Full replacement set for this product (rows omitted = deleted).
  tierPrices: z.array(tierPriceSchema),
});

export type VariantInput = z.infer<typeof variantSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type TierPriceInput = z.infer<typeof tierPriceSchema>;
export type SetTierPricesInput = z.infer<typeof setTierPricesSchema>;
