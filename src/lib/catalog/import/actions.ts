"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { toDecimal } from "@/lib/money";
import { parseWorkbook, type RowError } from "./parse";

/**
 * Bulk catalog import server action. Flow:
 *   1. auth,
 *   2. read the uploaded .xlsx into a Buffer,
 *   3. delegate parse + validation to the pure `parseWorkbook`,
 *   4. upsert valid products (by sku) and their variants (by variantSku),
 *   5. return a real per-row log: created/updated counts + every failure.
 *
 * Upsert semantics:
 *   - Product matched by `sku`: created if new, otherwise its product-level
 *     fields are updated.
 *   - Variant matched by `variantSku`: created under its product if new,
 *     otherwise updated. Variants are never deleted by import (non-destructive).
 */

export interface ImportSummary {
  totalRows: number;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  /** Rows that failed validation (never reached the DB). */
  errors: RowError[];
  /** Per-product outcome for the success log. */
  log: Array<{ sku: string; action: "created" | "updated"; variants: number }>;
}

export type ImportResult =
  | { ok: true; summary: ImportSummary }
  | { ok: false; error: string };

export async function importCatalog(formData: FormData): Promise<ImportResult> {
  await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "noFile" };
  }
  // Guard against accidental huge uploads (5 MB is plenty for a catalog sheet).
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "fileTooLarge" };

  const buffer = Buffer.from(await file.arrayBuffer());

  // Known categories — rows referencing an unknown slug are rejected by the
  // parser (we never invent categories during import).
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));
  const knownSlugs = new Set(slugToId.keys());

  let parsed;
  try {
    parsed = parseWorkbook(buffer, knownSlugs);
  } catch {
    return { ok: false, error: "parseFailed" };
  }

  const summary: ImportSummary = {
    totalRows: parsed.totalRows,
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    errors: [...parsed.errors],
    log: [],
  };

  // Upsert each valid product + its variants. Each product is its own
  // transaction so one DB-level failure (e.g. a variantSku already owned by
  // a different product) is isolated and reported per-row, not fatal.
  for (const p of parsed.products) {
    const categoryId = slugToId.get(p.categorySlug);
    if (!categoryId) {
      // Shouldn't happen (parser validated), but stay defensive.
      summary.errors.push({ row: 0, column: "category", message: "categoryUnknown" });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.product.findUnique({
          where: { sku: p.sku },
          select: { id: true },
        });

        let productId: string;
        let action: "created" | "updated";

        if (existing) {
          await tx.product.update({
            where: { id: existing.id },
            data: {
              nameEn: p.nameEn,
              nameAr: p.nameAr,
              brand: p.brand,
              categoryId,
              basePrice: toDecimal(p.basePrice),
              active: p.active,
              descriptionEn: p.descriptionEn,
              descriptionAr: p.descriptionAr,
            },
          });
          productId = existing.id;
          action = "updated";
          summary.productsUpdated++;
        } else {
          const created = await tx.product.create({
            data: {
              sku: p.sku,
              nameEn: p.nameEn,
              nameAr: p.nameAr,
              brand: p.brand,
              categoryId,
              basePrice: toDecimal(p.basePrice),
              active: p.active,
              descriptionEn: p.descriptionEn,
              descriptionAr: p.descriptionAr,
            },
            select: { id: true },
          });
          productId = created.id;
          action = "created";
          summary.productsCreated++;
        }

        for (const v of p.variants) {
          const existingVariant = await tx.productVariant.findUnique({
            where: { variantSku: v.variantSku },
            select: { id: true, productId: true },
          });
          const data = {
            colorName: v.colorName,
            colorHex: v.colorHex,
            capacity: v.capacity,
            barcode: v.barcode,
            priceOverride: v.priceOverride ? toDecimal(v.priceOverride) : null,
          };
          if (existingVariant) {
            // A variantSku owned by a DIFFERENT product is a conflict.
            if (existingVariant.productId !== productId) {
              throw new VariantConflict(v.variantSku);
            }
            await tx.productVariant.update({ where: { id: existingVariant.id }, data });
            summary.variantsUpdated++;
          } else {
            await tx.productVariant.create({ data: { ...data, variantSku: v.variantSku, productId } });
            summary.variantsCreated++;
          }
        }

        summary.log.push({ sku: p.sku, action, variants: p.variants.length });
      });
    } catch (e) {
      if (e instanceof VariantConflict) {
        summary.errors.push({
          row: 0,
          column: "variantSku",
          message: "variantSkuOwnedByOther",
        });
      } else {
        summary.errors.push({ row: 0, column: "sku", message: "importRowFailed" });
      }
    }
  }

  revalidatePath("/catalog");
  return { ok: true, summary };
}

/** Internal signal: a variantSku belongs to a different product. */
class VariantConflict extends Error {
  constructor(public variantSku: string) {
    super(`variant ${variantSku} owned by another product`);
  }
}
