import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Megaphone, Calendar, Plus } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listCampaigns } from "@/lib/campaigns/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const MODULE_KEY = "campaigns";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "campaigns" });
  return { title: t("title") };
}

const STATUS_TONE = {
  ACTIVE: "success",
  SCHEDULED: "info",
  EXPIRED: "neutral",
} as const;

export default async function CampaignsPage({
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
  const t = await getTranslations({ locale, namespace: "campaigns" });

  const { rows, total, pageCount } = await listCampaigns({ page });

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/campaigns?${qs}` : "/campaigns";
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={Megaphone}
        action={
          <Link href="/campaigns/new">
            <Button>
              <Plus />
              {t("newCampaign")}
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <section className="bg-card shadow-soft border-border flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-16 text-center">
          <span className="bg-primary-soft text-primary flex size-14 items-center justify-center rounded-2xl">
            <Megaphone className="size-6" />
          </span>
          <h2 className="font-display text-foreground text-xl font-semibold">
            {t("empty.title")}
          </h2>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
            {t("empty.body")}
          </p>
          <Link href="/campaigns/new">
            <Button>
              <Plus className="size-4" />
              {t("newCampaign")}
            </Button>
          </Link>
        </section>
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-180 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.name")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.occasion")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.dateRange")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.bundles")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="border-border hover:bg-muted/50 border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="text-foreground hover:text-primary font-semibold transition-colors"
                      >
                        {locale === "ar" ? c.nameAr : c.nameEn}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {c.occasion ?? (
                        <span className="text-muted-foreground/50">{t("occasion.none")}</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3.5" />
                        {dateFmt.format(c.startsAt)}
                        <span aria-hidden>→</span>
                        {dateFmt.format(c.endsAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground text-xs">
                        {t("table.bundleCount", { count: c.bundleCount })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
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
