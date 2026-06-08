import {
  TrendingUp,
  Wallet,
  ShoppingCart,
  Target,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { formatNumber, formatSar } from "@/lib/format";
import type { OverviewKpis } from "@/lib/queries/overview";

/**
 * Executive KPI row. Server component — pure presentation over the
 * pre-aggregated figures. Each card pairs a headline figure with a short,
 * honest hint describing exactly how it's derived (no vanity metrics).
 */
export async function KpiCards({
  kpis,
  locale,
}: {
  kpis: OverviewKpis;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "overview.kpi" });
  const pct = (v: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
      style: "percent",
      maximumFractionDigits: 1,
      numberingSystem: "latn",
    }).format(v);

  const cards: {
    icon: LucideIcon;
    label: string;
    hint: string;
    value: string;
    meta?: string;
    tone: "primary" | "accent" | "success" | "info";
  }[] = [
    {
      icon: TrendingUp,
      label: t("grossSales"),
      hint: t("grossSalesHint"),
      value: formatSar(kpis.grossSales, locale),
      meta: `${t("vatCollected")}: ${formatSar(kpis.vatCollected, locale)}`,
      tone: "primary",
    },
    {
      icon: Wallet,
      label: t("netMargin"),
      hint: t("netMarginHint"),
      value: formatSar(kpis.netMargin, locale),
      meta: pct(kpis.netMarginRate),
      tone: "success",
    },
    {
      icon: ShoppingCart,
      label: t("orderCount"),
      hint: t("orderCountHint"),
      value: formatNumber(kpis.orderCount, locale),
      meta: `${t("avgOrderValue")}: ${formatSar(kpis.avgOrderValue, locale)}`,
      tone: "accent",
    },
    {
      icon: Target,
      label: t("conversion"),
      hint: t("conversionHint"),
      value: pct(kpis.conversionProxy),
      meta: t("ofOrders", { count: kpis.convertedCount, total: kpis.orderCount }),
      tone: "info",
    },
  ];

  const toneClass: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent/15 text-accent-foreground",
    success: "bg-success/12 text-success",
    info: "bg-muted text-foreground",
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <article
            key={c.label}
            className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {c.label}
                </span>
              </div>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${toneClass[c.tone]}`}
              >
                <Icon className="size-4.5" />
              </span>
            </div>
            <p className="font-display text-foreground text-2xl font-semibold tabular-nums">
              {c.value}
            </p>
            <div className="flex flex-col gap-0.5">
              {c.meta && (
                <p className="text-foreground/80 text-xs font-medium tabular-nums">{c.meta}</p>
              )}
              <p className="text-muted-foreground text-xs leading-relaxed">{c.hint}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
