import { prisma } from "@/lib/prisma";

/**
 * Read-side data access for the SEO module + the sitemap/JSON-LD generators.
 * Pure queries returning plain shapes; Decimals are serialised at the
 * boundary.
 */

export const SEO_PAGE_SIZE = 12;

/** Canonical storefront path for a product (used in sitemap + JSON-LD). */
export function productPath(categorySlug: string, productSku: string): string {
  return `/products/${categorySlug}/${productSku.toLowerCase()}`;
}

export interface SeoProductFilter {
  search?: string;
  /** "with" | "without" meta, or undefined (all). */
  metaStatus?: "with" | "without";
  page: number;
}

export async function listProductsWithMeta(filter: SeoProductFilter) {
  const page = Math.max(1, filter.page);
  const where: import("@/generated/prisma/client").Prisma.ProductWhereInput = {};
  if (filter.search?.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { nameEn: { contains: q, mode: "insensitive" } },
      { nameAr: { contains: q } },
      { sku: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filter.metaStatus === "with") where.seoMeta = { isNot: null };
  if (filter.metaStatus === "without") where.seoMeta = { is: null };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { nameEn: "asc" },
      skip: (page - 1) * SEO_PAGE_SIZE,
      take: SEO_PAGE_SIZE,
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        sku: true,
        brand: true,
        seoMeta: { select: { metaTitle: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    rows: rows.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      sku: p.sku,
      brand: p.brand,
      hasMeta: Boolean(p.seoMeta),
      metaTitle: p.seoMeta?.metaTitle ?? null,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / SEO_PAGE_SIZE)),
  };
}

export type SeoProductRow = Awaited<ReturnType<typeof listProductsWithMeta>>["rows"][number];

/** Full SEO detail for a product (existing meta, or null if none yet). */
export async function getProductSeo(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      sku: true,
      brand: true,
      basePrice: true,
      category: { select: { slug: true } },
      seoMeta: {
        select: { metaTitle: true, metaDescription: true, keywords: true, jsonLd: true },
      },
    },
  });
  if (!product) return null;
  return {
    id: product.id,
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    sku: product.sku,
    brand: product.brand,
    basePrice: product.basePrice.toFixed(2),
    path: productPath(product.category.slug, product.sku),
    meta: product.seoMeta
      ? {
          metaTitle: product.seoMeta.metaTitle,
          metaDescription: product.seoMeta.metaDescription,
          keywords: product.seoMeta.keywords,
          jsonLd: product.seoMeta.jsonLd,
        }
      : null,
  };
}

export type ProductSeoDetail = NonNullable<Awaited<ReturnType<typeof getProductSeo>>>;

/** Counts for the SEO KPI strip. */
export async function getSeoStats() {
  const [products, withMeta, redirects] = await Promise.all([
    prisma.product.count(),
    prisma.seoMeta.count(),
    prisma.redirect.count(),
  ]);
  return { products, withMeta, withoutMeta: products - withMeta, redirects };
}

// ── Redirects ──────────────────────────────────────────────────

export async function listRedirects() {
  return prisma.redirect.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, fromPath: true, toPath: true, type: true, active: true },
  });
}

export type RedirectRow = Awaited<ReturnType<typeof listRedirects>>[number];

// ── Sitemap source ─────────────────────────────────────────────

/**
 * Active products with the data the sitemap needs. Only active products are
 * indexable. Returns the canonical path + last-modified timestamp.
 */
export async function getSitemapProducts() {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: {
      sku: true,
      updatedAt: true,
      category: { select: { slug: true } },
    },
  });
  return products.map((p) => ({
    path: productPath(p.category.slug, p.sku),
    lastModified: p.updatedAt,
  }));
}

/** Distinct active category slugs for category index URLs in the sitemap. */
export async function getSitemapCategories() {
  const categories = await prisma.category.findMany({
    select: { slug: true, updatedAt: true },
  });
  return categories.map((c) => ({ path: `/category/${c.slug}`, lastModified: c.updatedAt }));
}
