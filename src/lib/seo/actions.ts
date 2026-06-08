"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { productPath } from "./queries";
import {
  seoMetaSchema,
  redirectSchema,
  importRedirectsSchema,
  type SeoMetaInput,
  type RedirectInput,
  type ImportRedirectsInput,
} from "./schema";

/**
 * SEO mutations. Every action asserts auth, validates with Zod, returns a
 * `{ ok }` union. Saving a product's meta also (re)generates the Product
 * JSON-LD and stores it on the SeoMeta row so the storefront can emit it
 * verbatim — the JSON-LD is real structured data derived from the product.
 */

export type SeoResult = { ok: true } | { ok: false; error: string };

/** Build schema.org Product JSON-LD from the product + the saved meta. */
function buildProductJsonLd(args: {
  name: string;
  description: string;
  brand: string;
  sku: string;
  price: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: args.name,
    description: args.description,
    sku: args.sku,
    brand: { "@type": "Brand", name: args.brand },
    offers: {
      "@type": "Offer",
      priceCurrency: "SAR",
      price: args.price,
      availability: "https://schema.org/InStock",
      url: args.url,
    },
  };
}

export async function saveProductSeo(input: SeoMetaInput): Promise<SeoResult> {
  await requireUser();
  const parsed = seoMetaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id: d.productId },
    select: {
      nameEn: true,
      brand: true,
      sku: true,
      basePrice: true,
      category: { select: { slug: true } },
    },
  });
  if (!product) return { ok: false, error: "notFound" };

  const jsonLd = buildProductJsonLd({
    name: product.nameEn,
    description: d.metaDescription,
    brand: product.brand,
    sku: product.sku,
    price: product.basePrice.toFixed(2),
    url: productPath(product.category.slug, product.sku),
  });

  try {
    await prisma.seoMeta.upsert({
      where: { productId: d.productId },
      update: {
        metaTitle: d.metaTitle,
        metaDescription: d.metaDescription,
        keywords: d.keywords ?? "",
        jsonLd,
      },
      create: {
        productId: d.productId,
        metaTitle: d.metaTitle,
        metaDescription: d.metaDescription,
        keywords: d.keywords ?? "",
        jsonLd,
      },
    });
    revalidatePath("/seo");
    return { ok: true };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

// ── Redirects ──────────────────────────────────────────────────

export type RedirectResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveRedirect(input: RedirectInput): Promise<RedirectResult> {
  await requireUser();
  const parsed = redirectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;
  if (d.fromPath === d.toPath) return { ok: false, error: "samePathLoop" };

  try {
    const row = d.id
      ? await prisma.redirect.update({
          where: { id: d.id },
          data: { fromPath: d.fromPath, toPath: d.toPath, type: d.type, active: d.active },
          select: { id: true },
        })
      : await prisma.redirect.create({
          data: { fromPath: d.fromPath, toPath: d.toPath, type: d.type, active: d.active },
          select: { id: true },
        });
    revalidatePath("/seo");
    return { ok: true, id: row.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "fromPathTaken" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function deleteRedirect(id: string): Promise<SeoResult> {
  await requireUser();
  if (!id) return { ok: false, error: "invalid" };
  try {
    await prisma.redirect.delete({ where: { id } });
    revalidatePath("/seo");
    return { ok: true };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export interface ImportRedirectsResult {
  ok: true;
  created: number;
  skipped: number;
}

/**
 * Bulk-import redirects. Validated rows are inserted; rows whose fromPath
 * already exists are skipped (not overwritten) and counted. Uses
 * createMany with skipDuplicates so a clashing row never aborts the batch.
 */
export async function importRedirects(
  input: ImportRedirectsInput,
): Promise<ImportRedirectsResult | { ok: false; error: string }> {
  await requireUser();
  const parsed = importRedirectsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "noRows" };
  }
  const rows = parsed.data.redirects;

  try {
    const result = await prisma.redirect.createMany({
      data: rows.map((r) => ({
        fromPath: r.fromPath,
        toPath: r.toPath,
        type: r.type,
        active: true,
      })),
      skipDuplicates: true,
    });
    revalidatePath("/seo");
    return { ok: true, created: result.count, skipped: rows.length - result.count };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
