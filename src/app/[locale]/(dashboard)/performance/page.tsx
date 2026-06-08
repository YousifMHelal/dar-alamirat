import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Activity, TrendingUp, Repeat, Percent, ShoppingCart, Star } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { requireModuleAccess } from "@/lib/auth/guard";
import {
  DATA_RANGE_END,
  DATA_RANGE_START,
  getPerformanceKpis,
  getRevenueTrend,
  getConversionStats,
  getRetentionStats,
  getTopPerformingProducts,
  resolveRange,
} from "@/lib/performance/queries";
import { DateRangeFilter } from "@/components/overview/date-range-filter";
import { formatSar, formatNumber, formatPercent } from "@/lib/format";
import { RevenueTrendChart, TopPerformingProductsChart } from "@/components/performance/charts";

const MODULE_KEY = "performance";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "performance" });
  return { title: t("title") };
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function PerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "performance" });
  const isAr = locale === "ar";

  const fromDate = parseDate(sp.from);
  const toRaw = parseDate(sp.to);
  const toExclusive = toRaw ? new Date(toRaw.getTime() + 24 * 60 * 60 * 1000) : undefined;
  const range = resolveRange(fromDate, toExclusive);

  const [kpis, revenueTrend, conversion, retention, topProducts] = await Promise.all([
    getPerformanceKpis(range),
    getRevenueTrend(range),
    getConversionStats(range),
    getRetentionStats(range),
    getTopPerformingProducts(range, 10),
  ]);

  const filterFrom = isoDay(fromDate ?? DATA_RANGE_START);
  const inclusiveTo = toRaw ?? new Date(DATA_RANGE_END.getTime() - 24 * 60 * 60 * 1000);
  const filterTo = isoDay(inclusiveTo);

  const monthFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { month: "short", year: "2-digit" });
  const monthLabels: Record<string, string> = {};
  for (const point of revenueTrend) {
    monthLabels[point.month] = monthFmt.format(new Date(`${point.month}T00:00:00.000Z`));
  }

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", { day: "2-digit", month: "short" });

  const kpiCards = [
    { icon: TrendingUp, label: t("kpi.revenue"), value: formatSar(kpis.revenue, locale), tone: "primary" as const },
    { icon: ShoppingCart, label: t("kpi.orders"), value: formatNumber(kpis.orderCount, locale), tone: "info" as const },
    { icon: Percent, label: t("kpi.conversionRate"), value: formatPercent(kpis.conversionRate, locale), tone: "success" as const },
    { icon: Repeat, label: t("kpi.retentionRate"), value: formatPercent(kpis.retentionRate, locale), tone: "warning" as const },
    { icon: Activity, label: t("kpi.avgOrderValue"), value: formatSar(kpis.avgOrderValue, locale), tone: "primary" as const },
  ];
  const toneClass: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success/12 text-success",
    info: "bg-accent/15 text-accent-foreground",
    warning: "bg-warning/20 text-warning-foreground",
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-xl">
          <Activity className="size-5" />
        </span>
        <div className="flex flex-col">
          <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
      </header>

      <DateRangeFilter initialFrom={filterFrom} initialTo={filterTo} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5">
              <span className={`flex size-10 items-center justify-center rounded-xl ${toneClass[card.tone]}`}>
                <Icon className="size-4" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-xs font-medium">{card.label}</p>
                <p className="font-display text-foreground text-xl font-semibold tabular-nums">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueTrendChart data={revenueTrend} locale={locale} monthLabels={monthLabels} />
        <TopPerformingProductsChart data={topProducts} locale={locale} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
          <h2 className="font-display text-foreground mb-1 text-base font-semibold">{t("conversion.title")}</h2>
          <p className="text-muted-foreground mb-4 text-xs">{t("conversion.subtitle")}</p>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Stat label={t("conversion.orders")} value={formatNumber(conversion.orderCount, locale)} />
            <Stat label={t("conversion.converted")} value={formatNumber(conversion.convertedCount, locale)} />
            <Stat label={t("conversion.rate")} value={formatPercent(conversion.conversionRate, locale)} />
            <Stat label={t("conversion.trafficRatio")} value={formatNumber(parseFloat(conversion.trafficToOrderRatio.toFixed(2)), locale)} />
          </dl>
        </section>

        <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
          <h2 className="font-display text-foreground mb-1 text-base font-semibold">{t("retention.title")}</h2>
          <p className="text-muted-foreground mb-4 text-xs">{t("retention.subtitle")}</p>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Stat label={t("retention.totalCustomers")} value={formatNumber(retention.totalCustomers, locale)} />
            <Stat label={t("retention.repeatCustomers")} value={formatNumber(retention.repeatCustomers, locale)} />
            <Stat label={t("retention.rate")} value={formatPercent(retention.retentionRate, locale)} />
            <Stat label={t("retention.avgOrders")} value={formatNumber(parseFloat(retention.avgOrdersPerCustomer.toFixed(1)), locale)} />
          </dl>
        </section>
      </div>

      <section className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
        <div className="border-border border-b px-5 py-4">
          <h2 className="font-display text-foreground text-base font-semibold">{t("table.title")}</h2>
          <p className="text-muted-foreground text-xs">{t("table.subtitle")}</p>
        </div>
        <div className="scrollbar-subtle overflow-x-auto">
          <table className="w-full min-w-200 border-collapse text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                <th className="px-4 py-3 text-start font-semibold">{t("table.product")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("table.brand")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("table.unitsSold")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("table.revenue")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("table.rating")}</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={p.productId} className="border-border hover:bg-muted/50 border-b transition-colors last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-5 text-xs tabular-nums">{i + 1}</span>
                      <span className="text-foreground font-medium">{isAr ? p.nameAr : p.nameEn}</span>
                    </div>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{p.brand}</td>
                  <td className="text-foreground px-4 py-3 tabular-nums">{formatNumber(p.unitsSold, locale)}</td>
                  <td className="text-foreground px-4 py-3 font-medium tabular-nums">{formatSar(p.revenue, locale)}</td>
                  <td className="px-4 py-3">
                    {p.avgRating != null ? (
                      <span className="text-foreground inline-flex items-center gap-1 text-sm tabular-nums">
                        <Star className="size-3.5 fill-current text-warning" />
                        {formatNumber(parseFloat(p.avgRating.toFixed(1)), locale)}
                        <span className="text-muted-foreground text-xs">({formatNumber(p.reviewCount, locale)})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">{t("table.noRating")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-5 py-10 text-center text-sm">
                    {t("table.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {revenueTrend.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {t("rangeNote", { from: dateFmt.format(range.from), to: dateFmt.format(new Date(range.to.getTime() - 1)) })}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground font-display text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
