/**
 * Tabby + Tamara reconciliation logic.
 *
 * Flow:
 *   1. Fetch all settlements from Tabby and Tamara (their sandbox APIs).
 *   2. Match each settlement to a Payment row in our DB by merchantOrderId
 *      (which equals our orderNumber, stored as the reference at checkout).
 *   3. On match: update Payment.gatewayFee and mark Payment.status = RECONCILED.
 *   4. Return a full reconciliation report for the dashboard.
 */

"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { fetchAllTabbySettlements } from "@/lib/integrations/tabby";
import { fetchAllTamaraSettlements } from "@/lib/integrations/tamara";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ReconciliationLine {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  method: PaymentMethod;
  gateway: "TABBY" | "TAMARA";
  amount: string; // SAR
  gatewayFee: string; // SAR
  netAmount: string; // SAR
  settledAt: string;
  status: "RECONCILED" | "PENDING" | "FAILED";
  /** True if the gateway amount differs from the DB payment amount. */
  amountMismatch: boolean;
}

export interface ReconciliationSummary {
  runAt: string;
  tabbyLines: number;
  tamaraLines: number;
  matched: number;
  unmatched: number;
  totalFees: string; // SAR
  totalNet: string; // SAR
  lines: ReconciliationLine[];
  errors: string[];
}

// ─────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────

/** Payments pending reconciliation (TABBY or TAMARA, status PAID). */
export async function getPendingReconciliationPayments() {
  await requireUser();
  return prisma.payment.findMany({
    where: {
      method: { in: ["TABBY", "TAMARA"] },
      status: { in: ["PENDING", "PAID"] },
    },
    select: {
      id: true,
      method: true,
      amount: true,
      status: true,
      order: { select: { id: true, orderNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─────────────────────────────────────────────────────────────
// Reconciliation run (server action)
// ─────────────────────────────────────────────────────────────

export async function runReconciliation(): Promise<
  { ok: true; summary: ReconciliationSummary } | { ok: false; error: string }
> {
  await requireUser();

  const errors: string[] = [];
  const lines: ReconciliationLine[] = [];

  // ── Fetch Tabby settlements ────────────────────────────────
  const tabbyRes = await fetchAllTabbySettlements();
  const tabbySettlements = tabbyRes.ok ? tabbyRes.settlements : [];
  if (!tabbyRes.ok) errors.push(`Tabby: ${tabbyRes.error}`);

  // ── Fetch Tamara settlements ───────────────────────────────
  const tamaraRes = await fetchAllTamaraSettlements();
  const tamaraSettlements = tamaraRes.ok ? tamaraRes.settlements : [];
  if (!tamaraRes.ok) errors.push(`Tamara: ${tamaraRes.error}`);

  // ── Load all TABBY + TAMARA payments from DB ───────────────
  const dbPayments = await prisma.payment.findMany({
    where: { method: { in: ["TABBY", "TAMARA"] } },
    select: {
      id: true,
      method: true,
      amount: true,
      status: true,
      order: { select: { id: true, orderNumber: true } },
    },
  });

  // Index DB payments by order number for O(1) lookup.
  const dbByOrderNumber = new Map(
    dbPayments.map((p) => [p.order.orderNumber, p]),
  );

  let matched = 0;
  let unmatched = 0;
  let totalFees = new Prisma.Decimal(0);
  let totalNet = new Prisma.Decimal(0);

  // ── Match Tabby settlements ────────────────────────────────
  for (const s of tabbySettlements) {
    const dbPayment = dbByOrderNumber.get(s.merchantOrderId);
    if (!dbPayment) {
      unmatched++;
      continue;
    }

    const fee = new Prisma.Decimal(s.fee.toFixed(2));
    const net = new Prisma.Decimal(s.netAmount.toFixed(2));
    const gross = new Prisma.Decimal(s.grossAmount.toFixed(2));
    const dbAmount = dbPayment.amount;
    const amountMismatch = !gross.equals(dbAmount);

    await prisma.payment.update({
      where: { id: dbPayment.id },
      data: {
        status: "RECONCILED",
        gatewayFee: fee,
        settledAt: new Date(s.settledAt),
      },
    });

    totalFees = totalFees.add(fee);
    totalNet = totalNet.add(net);
    matched++;

    lines.push({
      paymentId: dbPayment.id,
      orderId: dbPayment.order.id,
      orderNumber: dbPayment.order.orderNumber,
      method: "TABBY",
      gateway: "TABBY",
      amount: gross.toFixed(2),
      gatewayFee: fee.toFixed(2),
      netAmount: net.toFixed(2),
      settledAt: s.settledAt,
      status: "RECONCILED",
      amountMismatch,
    });
  }

  // ── Match Tamara settlements ───────────────────────────────
  for (const s of tamaraSettlements) {
    const dbPayment = dbByOrderNumber.get(s.merchantOrderId);
    if (!dbPayment) {
      unmatched++;
      continue;
    }

    const fee = new Prisma.Decimal(s.fee.toFixed(2));
    const net = new Prisma.Decimal(s.netAmount.toFixed(2));
    const gross = new Prisma.Decimal(s.grossAmount.toFixed(2));
    const dbAmount = dbPayment.amount;
    const amountMismatch = !gross.equals(dbAmount);

    await prisma.payment.update({
      where: { id: dbPayment.id },
      data: {
        status: "RECONCILED",
        gatewayFee: fee,
        settledAt: new Date(s.settledAt),
      },
    });

    totalFees = totalFees.add(fee);
    totalNet = totalNet.add(net);
    matched++;

    lines.push({
      paymentId: dbPayment.id,
      orderId: dbPayment.order.id,
      orderNumber: dbPayment.order.orderNumber,
      method: "TAMARA",
      gateway: "TAMARA",
      amount: gross.toFixed(2),
      gatewayFee: fee.toFixed(2),
      netAmount: net.toFixed(2),
      settledAt: s.settledAt,
      status: "RECONCILED",
      amountMismatch,
    });
  }

  const summary: ReconciliationSummary = {
    runAt: new Date().toISOString(),
    tabbyLines: tabbySettlements.length,
    tamaraLines: tamaraSettlements.length,
    matched,
    unmatched,
    totalFees: totalFees.toFixed(2),
    totalNet: totalNet.toFixed(2),
    lines,
    errors,
  };

  // Persist summary so the dashboard can show the last run without re-fetching.
  await prisma.setting.upsert({
    where: { key: "reconciliation.last_run" },
    create: { key: "reconciliation.last_run", valueJson: summary as unknown as Prisma.InputJsonValue },
    update: { valueJson: summary as unknown as Prisma.InputJsonValue },
  });

  return { ok: true, summary };
}
