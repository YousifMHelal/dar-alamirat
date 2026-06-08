import { Prisma } from "@/generated/prisma/client";

/**
 * Money + VAT helpers — the single source of truth for currency MATH.
 *
 * Two rules govern this file:
 *   1. Money is ALWAYS Prisma.Decimal, never a JS Float. Floats accumulate
 *      rounding error across line items; Decimal is exact at 2 dp.
 *   2. KSA VAT is a flat 15%, applied to the order subtotal. We store
 *      subtotal / vatAmount / total explicitly (matching the Order model)
 *      so the breakdown is auditable rather than re-derived in the UI.
 *
 * This module imports Prisma and is therefore SERVER-ONLY. Display helpers
 * (formatSar / formatNumber) live in lib/format.ts so they can be used in
 * client components too; they're re-exported here for convenience.
 */

export { CURRENCY, formatSar, formatNumber } from "@/lib/format";

/** KSA value-added tax rate. */
export const VAT_RATE = new Prisma.Decimal("0.15");

type DecimalInput = Prisma.Decimal | number | string;

/** Coerce any money-ish input into a Decimal. */
export function toDecimal(value: DecimalInput): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/** Round a Decimal to 2 dp (KSA halala precision), half-up. */
export function round2(value: DecimalInput): Prisma.Decimal {
  return toDecimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export interface VatBreakdown {
  subtotal: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  total: Prisma.Decimal;
}

/**
 * Compute the VAT breakdown for an order from its pre-tax subtotal.
 * subtotal → vatAmount (15%) → total (subtotal + vat). Every value is
 * rounded to 2 dp so the three numbers always reconcile.
 */
export function computeVat(subtotal: DecimalInput): VatBreakdown {
  const sub = round2(subtotal);
  const vatAmount = round2(sub.mul(VAT_RATE));
  const total = round2(sub.add(vatAmount));
  return { subtotal: sub, vatAmount, total };
}

/** Sum a list of line totals into a Decimal subtotal. */
export function sumLineTotals(lineTotals: DecimalInput[]): Prisma.Decimal {
  return lineTotals.reduce<Prisma.Decimal>(
    (acc, lt) => acc.add(toDecimal(lt)),
    new Prisma.Decimal(0),
  );
}

/** unitPrice × quantity, rounded to 2 dp. */
export function lineTotal(unitPrice: DecimalInput, quantity: number): Prisma.Decimal {
  return round2(toDecimal(unitPrice).mul(quantity));
}
