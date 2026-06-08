import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus, Upload, PackageOpen, Boxes, Layers } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import {
  listProducts,
  listCategories,
  listBrands,
} from "@/lib/catalog/queries";
import { formatNumber, formatSar } from "@/lib/money";
import { CatalogHeader } from "@/components/catalog/page-header";
import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MODULE_KEY = "catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("title") };
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    brand?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "catalog" });

  const search = sp.q ?? "";
  const categoryId = sp.category || undefined;
  const brand = sp.brand || undefined;
  const active = sp.status === "active" ? "active" : sp.status === "inactive" ? "inactive" : undefined;
  const page = Number(sp.page) || 1;

  const [{ rows, total, pageCount }, categories, brands] = await Promise.all([
    listProducts({ search, categoryId, brand, active, page }),
    listCategories(),
    listBrands(),
  ]);

  // Preserve filters when paginating.
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (categoryId) params.set("category", categoryId);
    if (brand) params.set("brand", brand);
    if (sp.status) params.set("status", sp.status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/catalog?${qs}` : "/catalog";
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <>
            <Link href="/catalog/import">
              <Button variant="outline">
                <Upload />
                {t("import")}
              </Button>
            </Link>
            <Link href="/catalog/new">
              <Button>
                <Plus />
                {t("newProduct")}
              </Button>
            </Link>
          </>
        }
      />

      <CatalogToolbar
        locale={locale}
        initialSearch={search}
        initialCategory={categoryId ?? ""}
        initialBrand={brand ?? ""}
        initialStatus={sp.status ?? ""}
        categories={categories}
        brands={brands}
      />

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-220 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.product")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.category")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.sku")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("table.basePrice")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("table.variants")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("table.stock")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-border hover:bg-muted/50 group border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/catalog/${p.id}`}
                        className="text-foreground hover:text-primary font-medium underline-offset-4 group-hover:underline"
                      >
                        {locale === "ar" ? p.nameAr : p.nameEn}
                      </Link>
                      <div className="text-muted-foreground text-xs">{p.brand}</div>
                    </td>
                    <td className="text-foreground px-4 py-3">
                      {locale === "ar" ? p.category.nameAr : p.category.nameEn}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs tabular-nums">
                      {p.sku}
                    </td>
                    <td className="text-foreground px-4 py-3 text-end font-medium tabular-nums">
                      {formatSar(p.basePrice, locale)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <span className="text-foreground inline-flex items-center gap-1 tabular-nums">
                        <Layers className="text-muted-foreground size-3.5" />
                        {formatNumber(p.variantCount, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <span
                        className={`inline-flex items-center gap-1 tabular-nums ${
                          p.totalStock === 0 ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        <Boxes className="text-muted-foreground size-3.5" />
                        {formatNumber(p.totalStock, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.active ? (
                        <Badge tone="success">{t("table.active")}</Badge>
                      ) : (
                        <Badge tone="neutral">{t("table.inactive")}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-border flex items-center justify-between gap-4 border-t px-4 py-3">
            <p className="text-muted-foreground text-xs">
              {t("pagination.showing", { count: rows.length, total })}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("pagination.page", { page, pageCount })}
              </span>
              <PagerLink href={pageHref(page - 1)} disabled={page <= 1} label={t("pagination.prev")} />
              <PagerLink href={pageHref(page + 1)} disabled={page >= pageCount} label={t("pagination.next")} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PagerLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span className="border-border text-muted-foreground inline-flex h-8 cursor-not-allowed items-center rounded-lg border px-3 text-xs opacity-50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="border-border-strong bg-surface text-foreground hover:bg-muted inline-flex h-8 items-center rounded-lg border px-3 text-xs transition-colors"
    >
      {label}
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="bg-card shadow-soft border-border flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-16 text-center">
      <span className="bg-primary-soft text-primary flex size-14 items-center justify-center rounded-2xl">
        <PackageOpen className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
