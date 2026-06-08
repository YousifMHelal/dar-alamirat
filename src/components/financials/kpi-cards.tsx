import { TrendingUp, Receipt, CreditCard, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { formatSar, formatNumber } from "@/lib/format";

interface FinancialKpis {
  totalRevenue: string;
  totalFees: string;
  paymentCount: number;
  reconciledCount: number;
  vatCollected: string;
}

export async function FinancialKpiCards({
  kpis,
  locale,
}: {
  kpis: FinancialKpis;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "financials.kpi" });

  const cards = [
    {
      icon: TrendingUp,
      label: t("totalRevenue"),
      value: formatSar(kpis.totalRevenue, locale),
      tone: "primary" as const,
    },
    {
      icon: Receipt,
      label: t("vatCollected"),
      value: formatSar(kpis.vatCollected, locale),
      tone: "info" as const,
    },
    {
      icon: CreditCard,
      label: t("gatewayFees"),
      value: formatSar(kpis.totalFees, locale),
      tone: "warning" as const,
    },
    {
      icon: CheckCircle2,
      label: t("reconciled"),
      value: `${formatNumber(kpis.reconciledCount, locale)} / ${formatNumber(kpis.paymentCount, locale)}`,
      tone: "success" as const,
    },
  ];

  const toneMap = {
    primary: "bg-primary-soft text-sidebar-active-foreground",
    info: "bg-accent/15 text-accent-foreground",
    warning: "bg-warning/20 text-warning-foreground",
    success: "bg-success/12 text-success",
  };

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5"
          >
            <span
              className={`flex size-10 items-center justify-center rounded-xl ${toneMap[card.tone]}`}
            >
              <Icon className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs font-medium">{card.label}</p>
              <p className="font-display text-foreground text-xl font-semibold tabular-nums">
                {card.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
