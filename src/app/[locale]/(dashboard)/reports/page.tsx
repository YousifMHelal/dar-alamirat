import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BarChart3 } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { requireModuleAccess } from "@/lib/auth/guard";
import {
  DATA_RANGE_END,
  DATA_RANGE_START,
  getOverviewKpis,
  getSalesByCategory,
  getSalesOverTime,
  getTopProducts,
  resolveRange,
} from "@/lib/queries/overview";
import { DateRangeFilter } from "@/components/overview/date-range-filter";
import { formatSar, formatNumber, formatPercent } from "@/lib/format";
import { ExportButton } from "@/components/reports/export-button";

const MODULE_KEY = "reports";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });
  return { title: t(`${MODULE_KEY}.title`) };
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function ReportsPage({
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
  const t = await getTranslations({ locale, namespace: "reports" });

  const fromDate = parseDate(sp.from);
  const toRaw = parseDate(sp.to);
  const toExclusive = toRaw ? new Date(toRaw.getTime() + 24 * 60 * 60 * 1000) : undefined;
  const range = resolveRange(fromDate, toExclusive);

  const [kpis, salesOverTime, salesByCategory, topProducts] = await Promise.all([
    getOverviewKpis(range),
    getSalesOverTime(range),
    getSalesByCategory(range),
    getTopProducts(range, 20),
  ]);

  const filterFrom = isoDay(fromDate ?? DATA_RANGE_START);
  const inclusiveTo = toRaw ?? new Date(DATA_RANGE_END.getTime() - 24 * 60 * 60 * 1000);
  const filterTo = isoDay(inclusiveTo);

  const isAr = locale === "ar";

  // Prepare export data
  const monthlyCsvRows = salesOverTime.map((p) => ({
    Month: p.month,
    "Retail (SAR)": p.retail,
    "Wholesale (SAR)": p.wholesale,
    "Total (SAR)": p.total,
  }));

  const categoryCsvRows = salesByCategory.map((c) => ({
    Category: isAr ? c.nameAr : c.nameEn,
    "Sales (SAR)": c.sales,
    Units: c.units,
  }));

  const productCsvRows = topProducts.map((p) => ({
    Product: isAr ? p.nameAr : p.nameEn,
    Brand: p.brand,
    "Sales (SAR)": p.sales,
    Units: p.units,
  }));

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-xl">
            <BarChart3 className="size-5" />
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { label: t("kpi.grossSales"), value: formatSar(kpis.grossSales, locale) },
          { label: t("kpi.netSales"), value: formatSar(kpis.netSales, locale) },
          { label: t("kpi.vatCollected"), value: formatSar(kpis.vatCollected, locale) },
          { label: t("kpi.orders"), value: formatNumber(kpis.orderCount, locale) },
          { label: t("kpi.avgOrder"), value: formatSar(kpis.avgOrderValue, locale) },
          { label: t("kpi.b2bSales"), value: formatSar(kpis.b2b.sales, locale) },
          { label: t("kpi.b2cSales"), value: formatSar(kpis.b2c.sales, locale) },
          {
            label: t("kpi.conversion"),
            value: formatPercent(kpis.conversionProxy, locale),
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-card border-border flex flex-col gap-1 rounded-xl border p-4"
          >
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
            <span className="text-foreground text-lg font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {/* Monthly Sales Table */}
      <section className="bg-card border-border rounded-xl border">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-foreground font-semibold">{t("monthly.title")}</h2>
            <p className="text-muted-foreground text-sm">{t("monthly.subtitle")}</p>
          </div>
          <ExportButton
            filename={`monthly-sales-${filterFrom}-${filterTo}`}
            headers={["Month", "Retail (SAR)", "Wholesale (SAR)", "Total (SAR)"]}
            rows={monthlyCsvRows}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-start font-medium text-muted-foreground">{t("monthly.month")}</th>
                <th className="px-5 py-3 text-end font-medium text-muted-foreground">{t("monthly.retail")}</th>
                <th className="px-5 py-3 text-end font-medium text-muted-foreground">{t("monthly.wholesale")}</th>
                <th className="px-5 py-3 text-end font-medium text-muted-foreground">{t("monthly.total")}</th>
              </tr>
            </thead>
            <tbody>
              {salesOverTime.map((row) => (
                <tr key={row.month} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-3 text-foreground tabular-nums">{row.month}</td>
                  <td className="px-5 py-3 text-end tabular-nums">{formatSar(row.retail, locale)}</td>
                  <td className="px-5 py-3 text-end tabular-nums">{formatSar(row.wholesale, locale)}</td>
                  <td className="px-5 py-3 text-end font-medium tabular-nums">{formatSar(row.total, locale)}</td>
                </tr>
              ))}
              {salesOverTime.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two-column: Category + Top Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sales by Category */}
        <section className="bg-card border-border rounded-xl border">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-foreground font-semibold">{t("categories.title")}</h2>
              <p className="text-muted-foreground text-sm">{t("categories.subtitle")}</p>
            </div>
            <ExportButton
              filename={`category-sales-${filterFrom}-${filterTo}`}
              headers={["Category", "Sales (SAR)", "Units"]}
              rows={categoryCsvRows}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-start font-medium text-muted-foreground">{t("categories.category")}</th>
                  <th className="px-5 py-3 text-end font-medium text-muted-foreground">{t("categories.sales")}</th>
                  <th className="px-5 py-3 text-end font-medium text-muted-foreground">{t("categories.units")}</th>
                </tr>
              </thead>
              <tbody>
                {salesByCategory.map((cat) => (
                  <tr key={cat.categoryId} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3 text-foreground">{isAr ? cat.nameAr : cat.nameEn}</td>
                    <td className="px-5 py-3 text-end tabular-nums">{formatSar(cat.sales, locale)}</td>
                    <td className="px-5 py-3 text-end tabular-nums">{formatNumber(cat.units, locale)}</td>
                  </tr>
                ))}
                {salesByCategory.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">
                      {t("empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Products */}
        <section className="bg-card border-border rounded-xl border">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-foreground font-semibold">{t("products.title")}</h2>
              <p className="text-muted-foreground text-sm">{t("products.subtitle")}</p>
            </div>
            <ExportButton
              filename={`top-products-${filterFrom}-${filterTo}`}
              headers={["Product", "Brand", "Sales (SAR)", "Units"]}
              rows={productCsvRows}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-start font-medium text-muted-foreground">{t("products.product")}</th>
                  <th className="px-5 py-3 text-start font-medium text-muted-foreground">{t("products.brand")}</th>
                  <th className="px-5 py-3 text-end font-medium text-muted-foreground">{t("products.sales")}</th>
                  <th className="px-5 py-3 text-end font-medium text-muted-foreground">{t("products.units")}</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.productId} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular-nums text-xs w-5">{i + 1}</span>
                        <span className="text-foreground">{isAr ? p.nameAr : p.nameEn}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{p.brand}</td>
                    <td className="px-5 py-3 text-end tabular-nums">{formatSar(p.sales, locale)}</td>
                    <td className="px-5 py-3 text-end tabular-nums">{formatNumber(p.units, locale)}</td>
                  </tr>
                ))}
                {topProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                      {t("empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
