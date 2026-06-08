import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LayoutGrid } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { requireModuleAccess } from "@/lib/auth/guard";
import {
  DATA_RANGE_END,
  DATA_RANGE_START,
  getMobileSyncStatus,
  getOverviewKpis,
  getSalesByCategory,
  getSalesOverTime,
  getTopProducts,
  resolveRange,
} from "@/lib/queries/overview";
import { KpiCards } from "@/components/overview/kpi-cards";
import { DateRangeFilter } from "@/components/overview/date-range-filter";
import { SyncPanel } from "@/components/overview/sync-panel";
import {
  ChannelSplitChart,
  SalesByCategoryChart,
  SalesOverTimeChart,
  TopProductsChart,
} from "@/components/overview/charts";

const MODULE_KEY = "overview";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "overview" });
  return { title: t("title") };
}

/** Parse a yyyy-mm-dd search param into a UTC Date, or undefined. */
function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** yyyy-mm-dd for a Date (for date-input round-tripping). */
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Server-side RBAC: blocks roles without this module even via direct URL.
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "overview" });

  // The date inputs / preset are inclusive at the day level; the query
  // treats `to` as an exclusive bound, so push it to the end of that day.
  const fromDate = parseDate(sp.from);
  const toRaw = parseDate(sp.to);
  const toExclusive = toRaw ? new Date(toRaw.getTime() + 24 * 60 * 60 * 1000) : undefined;
  const range = resolveRange(fromDate, toExclusive);

  // All aggregates run against the same resolved window, in parallel.
  const [kpis, salesOverTime, salesByCategory, topProducts, syncRows] = await Promise.all([
    getOverviewKpis(range),
    getSalesOverTime(range),
    getSalesByCategory(range),
    getTopProducts(range),
    getMobileSyncStatus(),
  ]);

  // Localised short month labels computed server-side so the chart x-axis
  // renders identically on server and client (no hydration flicker).
  const monthFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    month: "short",
    year: "2-digit",
  });
  const monthLabels: Record<string, string> = {};
  for (const point of salesOverTime) {
    monthLabels[point.month] = monthFmt.format(new Date(`${point.month}T00:00:00.000Z`));
  }

  // Round-trip the resolved range back to the date inputs (clamped form).
  const filterFrom = isoDay(fromDate ?? DATA_RANGE_START);
  // Display the inclusive end-of-range day in the input.
  const inclusiveTo = toRaw ?? new Date(DATA_RANGE_END.getTime() - 24 * 60 * 60 * 1000);
  const filterTo = isoDay(inclusiveTo);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-xl">
            <LayoutGrid className="size-5" />
          </span>
          <div className="flex flex-col">
            <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
          </div>
        </div>
      </header>

      <DateRangeFilter initialFrom={filterFrom} initialTo={filterTo} />

      <KpiCards kpis={kpis} locale={locale} />

      {/* Primary trend spans full width; channel split sits beside it on lg. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesOverTimeChart data={salesOverTime} locale={locale} monthLabels={monthLabels} />
        </div>
        <ChannelSplitChart kpis={kpis} locale={locale} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SalesByCategoryChart data={salesByCategory} locale={locale} />
        <TopProductsChart data={topProducts} locale={locale} />
      </div>

      <SyncPanel rows={syncRows} locale={locale} />
    </div>
  );
}
