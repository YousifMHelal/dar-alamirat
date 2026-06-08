"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { toDecimal } from "@/lib/money";
import {
  categorySchema,
  updateCategorySchema,
  productSchema,
  setTierPricesSchema,
  updateProductSchema,
  type CategoryInput,
  type UpdateCategoryInput,
  type ProductInput,
  type SetTierPricesInput,
  type UpdateProductInput,
} from "./schema";

/**
 * Server actions for the Catalog module. Each mutation asserts an auth'd
 * user, validates with Zod, and returns a `{ ok }` discriminated union
 * instead of throwing. Money strings are converted to Prisma.Decimal here;
 * SKU/barcode uniqueness is enforced by the DB and surfaced as friendly
 * error keys.
 */

export type ProductMutationResult =
  | { ok: true; productId: string }
  | { ok: false; error: string; field?: string };

/** Normalise an optional string field: empty → null. */
const orNull = (v: string | undefined | null): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

/** Map a Prisma unique-constraint violation to a friendly error key. */
function uniqueError(e: unknown): ProductMutationResult | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = (e.meta?.target as string[] | undefined)?.join(",") ?? "";
    if (target.includes("variantSku")) return { ok: false, error: "variantSkuTaken" };
    if (target.includes("sku")) return { ok: false, error: "skuTaken" };
    return { ok: false, error: "duplicate" };
  }
  return null;
}

export async function createProduct(input: ProductInput): Promise<ProductMutationResult> {
  await requireUser();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  try {
    const product = await prisma.product.create({
      data: {
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        descriptionAr: orNull(d.descriptionAr),
        descriptionEn: orNull(d.descriptionEn),
        sku: d.sku,
        brand: d.brand,
        basePrice: toDecimal(d.basePrice),
        imageUrl: orNull(d.imageUrl),
        active: d.active,
        categoryId: d.categoryId,
        variants: {
          create: d.variants.map((v) => ({
            colorName: orNull(v.colorName),
            colorHex: orNull(v.colorHex),
            capacity: orNull(v.capacity),
            variantSku: v.variantSku,
            barcode: orNull(v.barcode),
            priceOverride: v.priceOverride && v.priceOverride.trim() ? toDecimal(v.priceOverride) : null,
          })),
        },
      },
      select: { id: true },
    });
    revalidatePath("/catalog");
    return { ok: true, productId: product.id };
  } catch (e) {
    return uniqueError(e) ?? { ok: false, error: "unknown" };
  }
}

export async function updateProduct(input: UpdateProductInput): Promise<ProductMutationResult> {
  await requireUser();
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  const existing = await prisma.product.findUnique({
    where: { id: d.id },
    select: { variants: { select: { id: true } } },
  });
  if (!existing) return { ok: false, error: "notFound" };

  // Diff variants: keep ids that are still present, delete the rest, create
  // the ones with no id, update the ones with an id.
  const submittedIds = new Set(d.variants.filter((v) => v.id).map((v) => v.id as string));
  const toDelete = existing.variants.filter((v) => !submittedIds.has(v.id)).map((v) => v.id);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: d.id },
        data: {
          nameAr: d.nameAr,
          nameEn: d.nameEn,
          descriptionAr: orNull(d.descriptionAr),
          descriptionEn: orNull(d.descriptionEn),
          sku: d.sku,
          brand: d.brand,
          basePrice: toDecimal(d.basePrice),
          imageUrl: orNull(d.imageUrl),
          active: d.active,
          categoryId: d.categoryId,
        },
      });

      // Deleting a variant cascades to its inventory/tier prices/order items.
      // Order items reference variants with onDelete default (Restrict), so a
      // variant that has been ordered cannot be removed — caught below.
      if (toDelete.length > 0) {
        await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (const v of d.variants) {
        const data = {
          colorName: orNull(v.colorName),
          colorHex: orNull(v.colorHex),
          capacity: orNull(v.capacity),
          variantSku: v.variantSku,
          barcode: orNull(v.barcode),
          priceOverride: v.priceOverride && v.priceOverride.trim() ? toDecimal(v.priceOverride) : null,
        };
        if (v.id) {
          await tx.productVariant.update({ where: { id: v.id }, data });
        } else {
          await tx.productVariant.create({ data: { ...data, productId: d.id } });
        }
      }
    });
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${d.id}`);
    return { ok: true, productId: d.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      // FK restrict — a variant we tried to delete is referenced by an order.
      return { ok: false, error: "variantInUse" };
    }
    return uniqueError(e) ?? { ok: false, error: "unknown" };
  }
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteProduct(id: string): Promise<DeleteResult> {
  await requireUser();
  if (!id) return { ok: false, error: "invalid" };
  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath("/catalog");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      // A variant of this product has been ordered → keep it, suggest deactivating.
      return { ok: false, error: "productInUse" };
    }
    return { ok: false, error: "unknown" };
  }
}

/**
 * Replace the full set of B2B tier prices for a product. Rows with an id are
 * updated, rows without are created, and any existing row not present in the
 * submitted set is deleted — so the editor is a single source of truth.
 */
export async function setTierPrices(input: SetTierPricesInput): Promise<DeleteResult> {
  await requireUser();
  const parsed = setTierPricesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const { productId, tierPrices } = parsed.data;

  // Guard: one row per tier (the schema enforces @@unique(pricingTierId, productId)).
  const seen = new Set<string>();
  for (const tp of tierPrices) {
    if (seen.has(tp.pricingTierId)) return { ok: false, error: "duplicateTier" };
    seen.add(tp.pricingTierId);
  }

  const existing = await prisma.tierPrice.findMany({
    where: { productId },
    select: { id: true },
  });
  const submittedIds = new Set(tierPrices.filter((t) => t.id).map((t) => t.id as string));
  const toDelete = existing.filter((t) => !submittedIds.has(t.id)).map((t) => t.id);

  try {
    await prisma.$transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx.tierPrice.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (const tp of tierPrices) {
        const data = {
          pricingTierId: tp.pricingTierId,
          productId,
          wholesalePrice: toDecimal(tp.wholesalePrice),
          moq: tp.moq,
        };
        if (tp.id) {
          await tx.tierPrice.update({ where: { id: tp.id }, data });
        } else {
          await tx.tierPrice.create({ data });
        }
      }
    });
    revalidatePath(`/catalog/${productId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "duplicateTier" };
    }
    return { ok: false, error: "unknown" };
  }
}

// ── Category mutations ────────────────────────────────────────

export type CategoryMutationResult =
  | { ok: true; categoryId: string }
  | { ok: false; error: string };

export async function createCategory(input: CategoryInput): Promise<CategoryMutationResult> {
  await requireUser();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;
  try {
    const category = await prisma.category.create({
      data: {
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        slug: d.slug,
        imageUrl: orNull(d.imageUrl),
      },
      select: { id: true },
    });
    revalidatePath("/catalog/categories");
    revalidatePath("/catalog");
    return { ok: true, categoryId: category.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "slugTaken" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function updateCategory(input: UpdateCategoryInput): Promise<CategoryMutationResult> {
  await requireUser();
  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  const existing = await prisma.category.findUnique({ where: { id: d.id }, select: { id: true } });
  if (!existing) return { ok: false, error: "notFound" };

  try {
    await prisma.category.update({
      where: { id: d.id },
      data: {
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        slug: d.slug,
        imageUrl: orNull(d.imageUrl),
      },
    });
    revalidatePath("/catalog/categories");
    revalidatePath(`/catalog/categories/${d.id}`);
    revalidatePath("/catalog");
    return { ok: true, categoryId: d.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "slugTaken" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function deleteCategory(id: string): Promise<DeleteResult> {
  await requireUser();
  if (!id) return { ok: false, error: "invalid" };
  try {
    await prisma.category.delete({ where: { id } });
    revalidatePath("/catalog/categories");
    revalidatePath("/catalog");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { ok: false, error: "categoryInUse" };
    }
    return { ok: false, error: "unknown" };
  }
}
