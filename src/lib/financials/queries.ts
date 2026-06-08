import { prisma } from "@/lib/prisma";
import type { ReconciliationSummary } from "./reconciliation";

/** Load financials KPIs: total payments, reconciled amounts, pending. */
export async function getFinancialKpis() {
  const [payments, reconciled, vatTotal] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: { in: ["PAID", "RECONCILED"] } },
      _sum: { amount: true, gatewayFee: true },
      _count: true,
    }),
    prisma.payment.count({ where: { status: "RECONCILED" } }),
    prisma.order.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: { vatAmount: true },
    }),
  ]);

  return {
    totalRevenue: payments._sum.amount?.toFixed(2) ?? "0.00",
    totalFees: payments._sum.gatewayFee?.toFixed(2) ?? "0.00",
    paymentCount: payments._count,
    reconciledCount: reconciled,
    vatCollected: vatTotal._sum.vatAmount?.toFixed(2) ?? "0.00",
  };
}

/** Load the last stored reconciliation summary from settings (for the dashboard). */
export async function getLastReconciliation(): Promise<ReconciliationSummary | null> {
  const setting = await prisma.setting.findUnique({
    where: { key: "reconciliation.last_run" },
  });
  if (!setting) return null;
  return setting.valueJson as unknown as ReconciliationSummary;
}
