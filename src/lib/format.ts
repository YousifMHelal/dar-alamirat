/**
 * Client-safe formatting helpers — NO Prisma import, so this module is safe
 * to pull into client components (the generated Prisma client drags in
 * Node-only modules that can't be bundled for the browser).
 *
 * lib/money.ts handles the Decimal MATH (server side); this file handles
 * DISPLAY of plain numbers/strings on either side.
 */

/** KSA VAT rate as a plain number, for client-side total previews. */
export const VAT_RATE_NUMBER = 0.15;

/** ISO currency code used throughout the portal. */
export const CURRENCY = "SAR";

const intlLocale = (locale: string) => (locale === "ar" ? "ar-SA" : "en-US");

/**
 * Anything that coerces to a number via Number(): a JS number, a numeric
 * string, or a Prisma.Decimal (which stringifies to its decimal value).
 * Typed structurally so this module needs no Prisma import.
 */
type Numeric = number | string | { toString(): string };

/**
 * Format a numeric value as a localised SAR amount. Arabic renders with
 * Arabic-Indic numerals; English with Western digits. Always 2 dp.
 */
export function formatSar(value: Numeric, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

/** Format a plain number with locale-aware grouping + numerals. */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** Format a 0–1 ratio as a percentage with one decimal place, locale-aware numerals. */
export function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
