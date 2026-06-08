import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { TEMPLATE_COLUMNS } from "@/lib/catalog/import/parse";

export const dynamic = "force-dynamic";

/**
 * GET /api/catalog/export?category=<slug>&active=true|false
 *
 * Streams the current catalog as .xlsx using the same column layout as the
 * import template (one row per variant, grouped by sku) — so an exported
 * file can be edited and re-imported directly.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const categorySlug = searchParams.get("category") ?? undefined;
  const activeParam = searchParams.get("active");
  const active = activeParam === "true" ? true : activeParam === "false" ? false : undefined;

  const where: { active?: boolean; category?: { slug: string } } = {};
  if (active != null) where.active = active;
  if (categorySlug) where.category = { slug: categorySlug };

  const products = await prisma.product.findMany({
    where,
    orderBy: { sku: "asc" },
    select: {
      sku: true,
      nameEn: true,
      nameAr: true,
      brand: true,
      basePrice: true,
      active: true,
      descriptionEn: true,
      descriptionAr: true,
      category: { select: { slug: true } },
      variants: {
        orderBy: { variantSku: "asc" },
        select: {
          variantSku: true,
          colorName: true,
          colorHex: true,
          capacity: true,
          barcode: true,
          priceOverride: true,
        },
      },
    },
  });

  const rows = products.flatMap((p) =>
    p.variants.map((v) => ({
      sku: p.sku,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      brand: p.brand,
      category: p.category.slug,
      basePrice: p.basePrice.toFixed(2),
      active: p.active ? "TRUE" : "FALSE",
      descriptionEn: p.descriptionEn ?? "",
      descriptionAr: p.descriptionAr ?? "",
      variantSku: v.variantSku,
      colorName: v.colorName ?? "",
      colorHex: v.colorHex ?? "",
      capacity: v.capacity ?? "",
      barcode: v.barcode ?? "",
      priceOverride: v.priceOverride ? v.priceOverride.toFixed(2) : "",
    })),
  );

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...TEMPLATE_COLUMNS] });
  XLSX.utils.book_append_sheet(wb, sheet, "products");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const fileName = `dar-alamirat-catalog-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
