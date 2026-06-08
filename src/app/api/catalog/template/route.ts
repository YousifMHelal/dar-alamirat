import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { TEMPLATE_COLUMNS } from "@/lib/catalog/import/parse";

// Generated per request (pulls live category slugs into the reference sheet).
export const dynamic = "force-dynamic";

/**
 * GET /api/catalog/template
 *
 * Streams the bulk-import .xlsx template: a header row in the canonical
 * column order, two example rows (a two-variant product) so the expected
 * shape is obvious, and a second "categories" sheet listing the valid
 * category slugs the importer will accept.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    orderBy: { nameEn: "asc" },
    select: { slug: true, nameEn: true, nameAr: true },
  });
  const sampleSlug = categories[0]?.slug ?? "skincare";

  // Two rows = one product ("DA-SAMPLE") with two capacity variants, so the
  // "one row per variant, grouped by sku" convention is self-documenting.
  const sampleRows = [
    {
      sku: "DA-SAMPLE",
      nameEn: "Sample Hydrating Serum",
      nameAr: "سيروم مرطب تجريبي",
      brand: "Amira Beauté",
      category: sampleSlug,
      basePrice: "129.00",
      active: "TRUE",
      descriptionEn: "Lightweight hydrating serum.",
      descriptionAr: "سيروم مرطب خفيف.",
      variantSku: "DA-SAMPLE-30",
      colorName: "",
      colorHex: "",
      capacity: "30ml",
      barcode: "6280000000001",
      priceOverride: "",
    },
    {
      sku: "DA-SAMPLE",
      nameEn: "Sample Hydrating Serum",
      nameAr: "سيروم مرطب تجريبي",
      brand: "Amira Beauté",
      category: sampleSlug,
      basePrice: "129.00",
      active: "TRUE",
      descriptionEn: "Lightweight hydrating serum.",
      descriptionAr: "سيروم مرطب خفيف.",
      variantSku: "DA-SAMPLE-50",
      colorName: "",
      colorHex: "",
      capacity: "50ml",
      barcode: "6280000000002",
      priceOverride: "169.00",
    },
  ];

  const wb = XLSX.utils.book_new();

  // Products sheet — header order fixed by TEMPLATE_COLUMNS.
  const productsSheet = XLSX.utils.json_to_sheet(sampleRows, {
    header: [...TEMPLATE_COLUMNS],
  });
  XLSX.utils.book_append_sheet(wb, productsSheet, "products");

  // Reference sheet — valid category slugs.
  const categoriesSheet = XLSX.utils.json_to_sheet(
    categories.map((c) => ({ slug: c.slug, nameEn: c.nameEn, nameAr: c.nameAr })),
    { header: ["slug", "nameEn", "nameAr"] },
  );
  XLSX.utils.book_append_sheet(wb, categoriesSheet, "categories");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="dar-alamirat-catalog-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
