import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sparkles, Plus } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listAffiliates, type AffiliateStatus } from "@/lib/affiliates/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSar, formatNumber } from "@/lib/format";

const MODULE_KEY = "affiliates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "affiliates" });
  return { title: t("title") };
}

const STATUS_TONE: Record<AffiliateStatus, "success" | "warning" | "neutral"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  ENDED: "neutral",
};

export default async function AffiliatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const t = await getTranslations({ locale, namespace: "affiliates" });

  const { rows, total, pageCount } = await listAffiliates({ page });

  const pageHref = (p: number) => {
    const qp = new URLSearchParams();
    if (p > 1) qp.set("page", String(p));
    const qs = qp.toString();
    return qs ? `/affiliates?${qs}` : "/affiliates";
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={Sparkles}
        action={
          <Link href="/affiliates/new">
            <Button>
              <Plus />
              {t("newAffiliate")}
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <section className="bg-card shadow-soft border-border flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-16 text-center">
          <span className="bg-primary-soft text-primary flex size-14 items-center justify-center rounded-2xl">
            <Sparkles className="size-6" />
          </span>
          <h2 className="font-display text-foreground text-xl font-semibold">{t("empty.title")}</h2>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{t("empty.body")}</p>
          <Link href="/affiliates/new">
            <Button>
              <Plus className="size-4" />
              {t("newAffiliate")}
            </Button>
          </Link>
        </section>
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-220 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.name")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.channel")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.code")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.rate")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.conversions")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.revenue")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.commission")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.newCustomers")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    className="border-border hover:bg-muted/50 border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/affiliates/${a.id}`}
                        className="text-foreground hover:text-primary font-semibold transition-colors"
                      >
                        {a.name}
                      </Link>
                      <span className="text-muted-foreground block text-xs">{a.handle}</span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {t(`channel.${a.channel}`)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-muted text-foreground rounded px-2 py-0.5 font-mono text-xs">
                        {a.code}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs tabular-nums">
                      {a.commissionRate}%
                    </td>
                    <td className="text-foreground px-4 py-3 tabular-nums">
                      {formatNumber(a.conversionCount, locale)}
                    </td>
                    <td className="text-foreground px-4 py-3 tabular-nums">
                      {formatSar(a.revenue, locale)}
                    </td>
                    <td className="text-foreground px-4 py-3 tabular-nums">
                      {formatSar(a.commission, locale)}
                    </td>
                    <td className="text-foreground px-4 py-3 tabular-nums">
                      {formatNumber(a.newCustomers, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[a.status]}>{t(`status.${a.status}`)}</Badge>
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
