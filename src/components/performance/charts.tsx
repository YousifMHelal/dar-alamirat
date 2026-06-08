"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatSar, formatNumber } from "@/lib/format";
import type { RevenueTrendPoint, PerformanceTopProduct } from "@/lib/performance/queries";
import { ChartCard, ChartEmpty } from "@/components/overview/chart-shell";
import type { ChartTheme } from "@/components/overview/chart-theme";

const isRtl = (locale: string) => locale === "ar";

function compactSar(value: number, locale: string): string {
  const intlLocale = locale === "ar" ? "ar-SA" : "en-US";
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "SAR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

interface TooltipEntry {
  name?: React.ReactNode;
  value?: unknown;
  color?: string;
}

function moneyTooltip(theme: ChartTheme, locale: string) {
  return function TooltipContent(props: { active?: boolean; payload?: readonly TooltipEntry[]; label?: React.ReactNode }) {
    if (!props.active || !props.payload?.length) return null;
    return (
      <div dir={isRtl(locale) ? "rtl" : "ltr"} className="border-border bg-card shadow-soft rounded-xl border px-3 py-2 text-xs">
        {props.label != null && <p className="text-foreground mb-1 font-medium">{String(props.label)}</p>}
        <ul className="flex flex-col gap-1">
          {props.payload.map((entry, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: entry.color ?? theme.primary }} />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="text-foreground ms-auto font-medium tabular-nums">{formatSar(Number(entry.value ?? 0), locale)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };
}


export function RevenueTrendChart({
  data,
  locale,
  monthLabels,
}: {
  data: RevenueTrendPoint[];
  locale: string;
  monthLabels: Record<string, string>;
}) {
  const t = useTranslations("performance.charts");
  const rtl = isRtl(locale);
  const points = data.map((p) => ({ ...p, revenue: Number(p.revenue) }));

  return (
    <ChartCard title={t("revenueTrend")} subtitle={t("revenueTrendSub")}>
      {({ theme, animate }) =>
        points.length === 0 ? (
          <ChartEmpty label={t("noData")} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="perfRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.series[0]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={theme.series[0]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={theme.grid} strokeDasharray="4 4" vertical={false} />
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
              <Tooltip content={moneyTooltip(theme, locale)} cursor={{ stroke: theme.grid }} />
              <Area
                type="monotone"
                dataKey="revenue"
                name={t("revenue")}
                stroke={theme.series[0]}
                strokeWidth={2}
                fill="url(#perfRevenue)"
                isAnimationActive={animate}
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      }
    </ChartCard>
  );
}

export function TopPerformingProductsChart({
  data,
  locale,
}: {
  data: PerformanceTopProduct[];
  locale: string;
}) {
  const t = useTranslations("performance.charts");
  const isAr = locale === "ar";
  const points = data
    .slice(0, 8)
    .map((p) => ({ name: isAr ? p.nameAr : p.nameEn, units: p.unitsSold }));

  if (points.length === 0) {
    return (
      <ChartCard title={t("topProducts")} subtitle={t("topProductsSub")} height={320}>
        {() => <ChartEmpty label={t("noData")} />}
      </ChartCard>
    );
  }

  const max = Math.max(...points.map((p) => p.units), 1);

  return (
    <ChartCard title={t("topProducts")} subtitle={t("topProductsSub")} height={320}>
      {({ theme }) => (
        <div className="flex h-full flex-col justify-between gap-1 overflow-hidden py-1">
          {points.map((p) => (
            <div key={p.name} className="flex min-w-0 items-center gap-2">
              {!isAr && (
                <span
                  className="w-36 shrink-0 truncate text-end text-xs"
                  style={{ color: theme.axis }}
                  title={p.name}
                >
                  {p.name}
                </span>
              )}
              <div className="relative flex-1 overflow-hidden">
                <div
                  className={`h-5 rounded ${isAr ? "ms-auto" : ""}`}
                  style={{
                    width: `${(p.units / max) * 100}%`,
                    background: theme.series[1],
                    minWidth: 4,
                  }}
                />
              </div>
              {isAr && (
                <span
                  className="w-36 shrink-0 truncate text-start text-xs"
                  style={{ color: theme.axis }}
                  title={p.name}
                >
                  {p.name}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
