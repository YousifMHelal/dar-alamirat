import { getTranslations } from "next-intl/server";
import { DollarSign } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { getFinancialKpis } from "@/lib/financials/invoice";
import { getLastReconciliation } from "@/lib/financials/reconciliation";
import { prisma } from "@/lib/prisma";
import { FinancialKpiCards } from "./kpi-cards";
import { ReconciliationPanel } from "./reconciliation-panel";
import { ZatcaPanel } from "./zatca-panel";

/**
 * Server component — fetches all financials data and renders the dashboard.
 * Client sub-panels (reconciliation run, ZATCA generate) handle their own
 * mutation state via useTransition.
 */
export async function FinancialsDashboard({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "modules.financials" });

  const [kpis, lastReconciliation, recentOrders] = await Promise.all([
    getFinancialKpis(),
    getLastReconciliation(),
    prisma.order.findMany({
      where: { status: { not: "CANCELLED" } },
      orderBy: { placedAt: "desc" },
      take: 50,
      select: { id: true, orderNumber: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <header className="border-border flex flex-col gap-3 border-b pb-6">
        <div className="flex items-center gap-3">
          <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-xl">
            <DollarSign className="size-5" />
          </span>
        </div>
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          {t("description")}
        </p>
      </header>

      {/* KPI row */}
      <FinancialKpiCards kpis={kpis} locale={locale} />

      {/* Two-column layout for the two main panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tabby + Tamara reconciliation */}
        <ReconciliationPanel initial={lastReconciliation} locale={locale} />

        {/* ZATCA invoice generation */}
        <ZatcaPanel orders={recentOrders} />
      </div>
    </div>
  );
}
