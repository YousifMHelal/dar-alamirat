"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatSar } from "@/lib/format";
import type {
  CategorySales,
  OverviewKpis,
  SalesPoint,
  TopProduct,
} from "@/lib/queries/overview";
import { ChartCard, ChartEmpty } from "./chart-shell";
import type { ChartTheme } from "./chart-theme";

/**
 * The four Recharts visualisations for the Overview module. All share the
 * resolved CSS-variable theme, a SAR-aware tooltip, and locale formatting.
 *
 * RTL: Recharts reads layout direction from the container's `dir`, which is
 * already `rtl` on <html> for Arabic, so the category axis, bars, and
 * tooltips mirror automatically. We only flip the y-axis `orientation` and
 * keep numerals locale-formatted (Arabic-Indic in `ar`).
 */

const isRtl = (locale: string) => locale === "ar";

/** Compact SAR for axis ticks (e.g. "SAR 45K") — full value lives in tooltip. */
function compactSar(value: number, locale: string): string {
  const intlLocale = locale === "ar" ? "ar-SA" : "en-US";
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "SAR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Minimal shape of the bits of the Recharts tooltip payload we render. */
interface TooltipEntry {
  name?: React.ReactNode;
  value?: unknown;
  color?: string;
}
interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: React.ReactNode;
  theme: ChartTheme;
  locale: string;
}

/**
 * Builds the `content` render prop for a Recharts <Tooltip>. Recharts'
 * generic tooltip props are awkward to spread into a typed component, so we
 * read just the fields we need off the loosely-typed props and hand them to
 * the shared body.
 */
function tooltipContent(theme: ChartTheme, locale: string) {
  function TooltipContent(props: {
    active?: boolean;
    payload?: readonly TooltipEntry[];
    label?: React.ReactNode;
  }) {
    return (
      <ChartTooltip
        active={props.active}
        payload={props.payload}
        label={props.label}
        theme={theme}
        locale={locale}
      />
    );
  }
  return TooltipContent;
}

/** Shared tooltip body so all charts present values identically. */
function ChartTooltip({ active, payload, label, theme, locale }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className="border-border bg-card shadow-soft rounded-xl border px-3 py-2 text-xs"
    >
      {label != null && (
        <p className="text-foreground mb-1 font-medium">{String(label)}</p>
      )}
      <ul className="flex flex-col gap-1">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: entry.color ?? theme.primary }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="text-foreground ms-auto font-medium tabular-nums">
              {formatSar(Number(entry.value ?? 0), locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Sales over time (area, two channels) ───────────────────────

export function SalesOverTimeChart({
  data,
  locale,
  monthLabels,
}: {
  data: SalesPoint[];
  locale: string;
  /** month-key → localized short label, computed server-side for SSR parity. */
  monthLabels: Record<string, string>;
}) {
  const t = useTranslations("overview.charts");
  const rtl = isRtl(locale);

  return (
    <ChartCard title={t("salesOverTime")} subtitle={t("salesOverTimeSub")}>
      {({ theme, animate }) =>
        data.length === 0 ? (
          <ChartEmpty label={t("noData")} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="ovTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.series[0]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={theme.series[0]} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ovWholesale" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.series[1]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={theme.series[1]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                reversed={rtl}
                tickFormatter={(m: string) => monthLabels[m] ?? m}
                tick={{ fill: theme.axis, fontSize: 12 }}
                axisLine={{ stroke: theme.grid }}
                tickLine={false}
              />
              <YAxis
                orientation={rtl ? "right" : "left"}
                tickFormatter={(v: number) => compactSar(v, locale)}
                tick={{ fill: theme.axis, fontSize: 11, textAnchor: "end" }}
                axisLine={false}
                tickLine={false}
                width={rtl ? 80 : 64}
              />
              <Tooltip
                content={tooltipContent(theme, locale)}
                cursor={{ stroke: theme.grid }}
              />
              <Area
                type="monotone"
                dataKey="total"
                name={t("total")}
                stroke={theme.series[0]}
                strokeWidth={2}
                fill="url(#ovTotal)"
                isAnimationActive={animate}
              />
              <Area
                type="monotone"
                dataKey="wholesale"
                name={t("wholesale")}
                stroke={theme.series[1]}
                strokeWidth={2}
                fill="url(#ovWholesale)"
                isAnimationActive={animate}
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      }
    </ChartCard>
  );
}

// ── Sales by category (horizontal bar) ─────────────────────────

export function SalesByCategoryChart({
  data,
  locale,
}: {
  data: CategorySales[];
  locale: string;
}) {
  const t = useTranslations("overview.charts");
  const rtl = isRtl(locale);
  const rows = data.map((c) => ({
    name: rtl ? c.nameAr : c.nameEn,
    sales: Number(c.sales),
  }));

  return (
    <ChartCard title={t("salesByCategory")} subtitle={t("salesByCategorySub")}>
      {({ theme, animate }) =>
        rows.length === 0 ? (
          <ChartEmpty label={t("noData")} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
            >
              <XAxis
                type="number"
                orientation="bottom"
                reversed={rtl}
                tickFormatter={(v: number) => compactSar(v, locale)}
                tick={{ fill: theme.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                orientation={rtl ? "right" : "left"}
                tick={{ fill: theme.axis, fontSize: 12, textAnchor: "end" }}
                axisLine={false}
                tickLine={false}
                width={rtl ? 140 : 96}
              />
              <Tooltip
                content={tooltipContent(theme, locale)}
                cursor={{ fill: theme.grid, fillOpacity: 0.3 }}
              />
              <Bar dataKey="sales" name={t("sales")} radius={[0, 6, 6, 0]} isAnimationActive={animate}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={theme.series[i % theme.series.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }
    </ChartCard>
  );
}

// ── B2B vs B2C split (donut) ───────────────────────────────────

export function ChannelSplitChart({
  kpis,
  locale,
}: {
  kpis: OverviewKpis;
  locale: string;
}) {
  const t = useTranslations("overview");
  const tc = useTranslations("overview.charts");
  const rows = [
    { key: "b2b", name: t("split.b2b"), value: Number(kpis.b2b.sales), orders: kpis.b2b.orders },
    { key: "b2c", name: t("split.b2c"), value: Number(kpis.b2c.sales), orders: kpis.b2c.orders },
  ];
  const totalSales = rows.reduce((a, r) => a + r.value, 0);

  return (
    <ChartCard title={t("split.title")} subtitle={t("split.subtitle")} height={280}>
      {({ theme, animate }) =>
        totalSales === 0 ? (
          <ChartEmpty label={tc("noData")} />
        ) : (
          <div className="flex h-full items-center gap-4">
            <div className="h-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="82%"
                    paddingAngle={2}
                    stroke={theme.surface}
                    strokeWidth={2}
                    isAnimationActive={animate}
                  >
                    {rows.map((_, i) => (
                      <Cell key={i} fill={theme.series[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={tooltipContent(theme, locale)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Direct legend with exact values — donuts must not rely on
                colour alone (a11y). */}
            <ul className="flex flex-1 flex-col gap-3 text-sm">
              {rows.map((r, i) => {
                const pct = totalSales > 0 ? Math.round((r.value / totalSales) * 100) : 0;
                return (
                  <li key={r.key} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ background: theme.series[i] }}
                      />
                      <span className="text-foreground font-medium">{r.name}</span>
                      <span className="text-muted-foreground ms-auto text-xs tabular-nums">
                        {pct}%
                      </span>
                    </div>
                    <div className="text-foreground ps-5 font-semibold tabular-nums">
                      {formatSar(r.value, locale)}
                    </div>
                    <div className="text-muted-foreground ps-5 text-xs">
                      {t("split.orders", { count: r.orders })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      }
    </ChartCard>
  );
}

// ── Top products (horizontal bar) ──────────────────────────────

export function TopProductsChart({
  data,
  locale,
}: {
  data: TopProduct[];
  locale: string;
}) {
  const t = useTranslations("overview.charts");
  const rtl = isRtl(locale);
  const rows = data.map((p) => ({
    name: rtl ? p.nameAr : p.nameEn,
    sales: Number(p.sales),
  }));

  return (
    <ChartCard title={t("topProducts")} subtitle={t("topProductsSub")} height={320}>
      {({ theme, animate }) =>
        rows.length === 0 ? (
          <ChartEmpty label={t("noData")} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
            >
              <XAxis
                type="number"
                reversed={rtl}
                tickFormatter={(v: number) => compactSar(v, locale)}
                tick={{ fill: theme.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                orientation={rtl ? "right" : "left"}
                tick={{ fill: theme.axis, fontSize: 11, textAnchor: "end" }}
                axisLine={false}
                tickLine={false}
                width={rtl ? 170 : 150}
              />
              <Tooltip
                content={tooltipContent(theme, locale)}
                cursor={{ fill: theme.grid, fillOpacity: 0.3 }}
              />
              <Bar
                dataKey="sales"
                name={t("sales")}
                radius={[0, 6, 6, 0]}
                fill={theme.series[0]}
                isAnimationActive={animate}
              />
            </BarChart>
          </ResponsiveContainer>
        )
      }
    </ChartCard>
  );
}
