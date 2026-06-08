import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read-side data access for the Catalog module. Pure queries (no auth, no
 * mutations) returning plain shapes the Server Components render directly.
 * Decimals are serialised to fixed-2 strings at the boundary so client
 * components never touch Prisma.Decimal.
 */

export const CATALOG_PAGE_SIZE = 12;

export interface CatalogFilter {
  /** Free-text: matches name (ar/en), brand, or SKU (case-insensitive). */
  search?: string;
  categoryId?: string;
  brand?: string;
  /** "active" | "inactive" | undefined (all). */
  active?: "active" | "inactive";
  page: number;
}

function buildWhere(filter: CatalogFilter): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  if (filter.categoryId) where.categoryId = filter.categoryId;
  if (filter.brand) where.brand = filter.brand;
  if (filter.active === "active") where.active = true;
  if (filter.active === "inactive") where.active = false;
  if (filter.search?.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { nameEn: { contains: q, mode: "insensitive" } },
      { nameAr: { contains: q } },
      { brand: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listProducts(filter: CatalogFilter) {
  const where = buildWhere(filter);
  const page = Math.max(1, filter.page);

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        sku: true,
        brand: true,
        basePrice: true,
        active: true,
        category: { select: { id: true, nameEn: true, nameAr: true } },
        _count: { select: { variants: true, tierPrices: true } },
        // Sum stock across all variants/warehouses for an at-a-glance total.
        variants: {
          select: { inventoryItems: { select: { quantityOnHand: true } } },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const shaped = rows.map((p) => {
    const totalStock = p.variants.reduce(
      (sum, v) => sum + v.inventoryItems.reduce((s, i) => s + i.quantityOnHand, 0),
      0,
    );
    return {
      id: p.id,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      sku: p.sku,
      brand: p.brand,
      basePrice: p.basePrice.toFixed(2),
      active: p.active,
      category: p.category,
      variantCount: p._count.variants,
      tierPriceCount: p._count.tierPrices,
      totalStock,
    };
  });

  return {
    rows: shaped,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
  };
}

export type ProductListRow = Awaited<ReturnType<typeof listProducts>>["rows"][number];

/** Full product detail for the edit page (variants + tier prices). */
export async function getProductDetail(id: string) {
  const p = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      descriptionEn: true,
      descriptionAr: true,
      sku: true,
      brand: true,
      basePrice: true,
      active: true,
      categoryId: true,
      variants: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          colorName: true,
          colorHex: true,
          capacity: true,
          variantSku: true,
          barcode: true,
          priceOverride: true,
        },
      },
      tierPrices: {
        select: {
          id: true,
          pricingTierId: true,
          wholesalePrice: true,
          moq: true,
          pricingTier: { select: { name: true } },
        },
      },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    descriptionEn: p.descriptionEn,
    descriptionAr: p.descriptionAr,
    sku: p.sku,
    brand: p.brand,
    basePrice: p.basePrice.toFixed(2),
    active: p.active,
    categoryId: p.categoryId,
    variants: p.variants.map((v) => ({
      id: v.id,
      colorName: v.colorName,
      colorHex: v.colorHex,
      capacity: v.capacity,
      variantSku: v.variantSku,
      barcode: v.barcode,
      priceOverride: v.priceOverride ? v.priceOverride.toFixed(2) : null,
    })),
    tierPrices: p.tierPrices.map((tp) => ({
      id: tp.id,
      pricingTierId: tp.pricingTierId,
      tierName: tp.pricingTier.name,
      wholesalePrice: tp.wholesalePrice.toFixed(2),
      moq: tp.moq,
    })),
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;

/** Categories for filter dropdowns + the product form's category picker. */
export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { nameEn: "asc" },
    select: { id: true, nameEn: true, nameAr: true, slug: true },
  });
}

/** Pricing tiers for the B2B price editor. */
export async function listPricingTiers() {
  return prisma.pricingTier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true },
  });
}

/** Distinct brands present in the catalog (for the brand filter). */
export async function listBrands(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    distinct: ["brand"],
    orderBy: { brand: "asc" },
    select: { brand: true },
  });
  return rows.map((r) => r.brand);
}
