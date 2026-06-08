import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Search, FileText, FileWarning, Milestone, ExternalLink } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import {
  listProductsWithMeta,
  listRedirects,
  getSeoStats,
} from "@/lib/seo/queries";
import { formatNumber } from "@/lib/money";
import { CatalogHeader } from "@/components/catalog/page-header";
import { MetaToolbar } from "@/components/seo/meta-toolbar";
import { RedirectManager } from "@/components/seo/redirect-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const MODULE_KEY = "seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return { title: t("title") };
}

export default async function SeoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tab?: string; q?: string; meta?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "seo" });
  const tab = sp.tab === "redirects" ? "redirects" : "meta";
  const stats = await getSeoStats();

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={Search}
        action={
          <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <ExternalLink />
              {t("sitemap.view")}
            </Button>
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={FileText} label={t("kpi.products")} value={formatNumber(stats.products, locale)} tone="info" />
        <Kpi icon={FileText} label={t("kpi.withMeta")} value={formatNumber(stats.withMeta, locale)} tone="success" />
        <Kpi
          icon={FileWarning}
          label={t("kpi.withoutMeta")}
          value={formatNumber(stats.withoutMeta, locale)}
          tone={stats.withoutMeta > 0 ? "warning" : "success"}
        />
        <Kpi icon={Milestone} label={t("kpi.redirects")} value={formatNumber(stats.redirects, locale)} tone="accent" />
      </div>

      <div className="border-border flex gap-1 border-b">
        <TabLink href="/seo?tab=meta" active={tab === "meta"} label={t("tabs.meta")} />
        <TabLink href="/seo?tab=redirects" active={tab === "redirects"} label={t("tabs.redirects")} />
      </div>

      {tab === "meta" ? (
        <MetaTab locale={locale} search={sp.q ?? ""} status={sp.meta ?? ""} page={Number(sp.page) || 1} raw={sp} />
      ) : (
        <RedirectManager initial={await listRedirects()} />
      )}
    </div>
  );
}

async function MetaTab({
  locale,
  search,
  status,
  page,
  raw,
}: {
  locale: Locale;
  search: string;
  status: string;
  page: number;
  raw: { q?: string; meta?: string };
}) {
  const t = await getTranslations({ locale, namespace: "seo.meta" });
  const metaStatus = status === "with" ? "with" : status === "without" ? "without" : undefined;
  const { rows, total, pageCount } = await listProductsWithMeta({ search, metaStatus, page });

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("tab", "meta");
    if (raw.q) params.set("q", raw.q);
    if (raw.meta) params.set("meta", raw.meta);
    if (p > 1) params.set("page", String(p));
    return `/seo?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <MetaToolbar initialSearch={search} initialStatus={status} />

      {rows.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-200 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("product")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("status")}</th>
                  <th className="px-4 py-3 text-end font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-border hover:bg-muted/40 group border-b transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <div className="text-foreground font-medium">
                        {locale === "ar" ? p.nameAr : p.nameEn}
                      </div>
                      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <span className="font-mono">{p.sku}</span>
                        <span>· {p.brand}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.hasMeta ? (
                        <Badge tone="success">{t("present")}</Badge>
                      ) : (
                        <Badge tone="warning">{t("missing")}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link href={`/seo/${p.id}`}>
                        <Button variant="outline" size="sm">
                          {t("edit")}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-border flex items-center justify-between gap-4 border-t px-4 py-3">
            <p className="text-muted-foreground text-xs tabular-nums">{`${rows.length} / ${total}`}</p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">{`${page} / ${pageCount}`}</span>
              <PagerLink href={pageHref(page - 1)} disabled={page <= 1} label="‹" />
              <PagerLink href={pageHref(page + 1)} disabled={page >= pageCount} label="›" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  tone: "info" | "success" | "warning" | "accent";
}) {
  const toneClass: Record<string, string> = {
    info: "bg-muted text-foreground",
    success: "bg-success/12 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    accent: "bg-accent/15 text-accent-foreground",
  };
  return (
    <article className="bg-card shadow-soft border-border flex items-center gap-3 rounded-2xl border p-4">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneClass[tone]}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-foreground text-xl font-semibold tabular-nums">{value}</p>
        <p className="text-muted-foreground truncate text-xs">{label}</p>
      </div>
    </article>
  );
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent"
      }`}
    >
      {label}
    </Link>
  );
}

function PagerLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span className="border-border text-muted-foreground inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg border opacity-50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="border-border-strong bg-surface text-foreground hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
    >
      {label}
    </Link>
  );
}
