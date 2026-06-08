import { getSitemapProducts, getSitemapCategories } from "@/lib/seo/queries";

/**
 * GET /sitemap.xml
 *
 * A real sitemap generated from the database: every active product (canonical
 * /products/<category>/<sku> path) plus each category index, each emitted for
 * both locales (ar/en) with hreflang alternates. Regenerated per request so
 * catalog/SEO changes are reflected immediately.
 */
export const dynamic = "force-dynamic";

const LOCALES = ["ar", "en"] as const;

/** Site origin — env override in real deployments, sensible dev default. */
function origin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://daralamirat.sa").replace(/\/$/, "");
}

/** XML-escape a URL/text value for safe inclusion in the document. */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface Entry {
  path: string;
  lastModified: Date;
}

/** One <url> per locale, with xhtml:link alternates for the other locale. */
function urlEntry(base: string, entry: Entry): string {
  return LOCALES.map((locale) => {
    const loc = `${base}/${locale}${entry.path}`;
    const alternates = LOCALES.map(
      (alt) =>
        `    <xhtml:link rel="alternate" hreflang="${alt}" href="${xml(`${base}/${alt}${entry.path}`)}" />`,
    ).join("\n");
    return [
      "  <url>",
      `    <loc>${xml(loc)}</loc>`,
      `    <lastmod>${entry.lastModified.toISOString()}</lastmod>`,
      alternates,
      "  </url>",
    ].join("\n");
  }).join("\n");
}

export async function GET() {
  const base = origin();
  const [products, categories] = await Promise.all([
    getSitemapProducts(),
    getSitemapCategories(),
  ]);

  const staticEntries: Entry[] = [{ path: "", lastModified: new Date() }];
  const all: Entry[] = [...staticEntries, ...categories, ...products];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...all.map((e) => urlEntry(base, e)),
    "</urlset>",
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
