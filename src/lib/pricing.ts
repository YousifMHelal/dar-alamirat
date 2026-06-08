import { Prisma } from "@/generated/prisma/client";
import { toDecimal } from "@/lib/money";

/**
 * Pricing resolution — retail vs. wholesale, and MOQ enforcement.
 *
 * Pure functions (no Prisma client, no IO) so the rules are unit-testable
 * in isolation. The server action loads the relevant rows and hands them
 * to these resolvers.
 *
 * AC#2:
 *   - A B2B_SALON customer linked to a pricing tier pays that tier's
 *     TierPrice.wholesalePrice and is bound by TierPrice.moq per line.
 *   - A RETAIL customer (or a B2B customer with no tier price for an item)
 *     pays the product/variant base price; no MOQ applies.
 */

export type PricingMode = "RETAIL" | "WHOLESALE";

/**
 * The price reference for one variant: its retail price (base price, or a
 * per-variant override if set) plus — when the customer's tier prices this
 * variant's product — the wholesale price and MOQ for that tier.
 */
export interface VariantPricing {
  variantId: string;
  productId: string;
  /** Retail price actually charged at retail: priceOverride ?? basePrice. */
  retailPrice: Prisma.Decimal;
  /** Wholesale price for the customer's tier, if the tier prices it. */
  wholesalePrice?: Prisma.Decimal | null;
  /** Minimum order quantity for the tier, if priced. */
  moq?: number | null;
}

export interface ResolvedLinePrice {
  variantId: string;
  unitPrice: Prisma.Decimal;
  mode: PricingMode;
  /** Effective MOQ for this line (1 for retail / unpriced wholesale). */
  moq: number;
}

/**
 * Resolve the unit price + MOQ for a single variant given the customer's
 * pricing mode.
 *
 * Wholesale applies only when the customer is wholesale AND the tier
 * actually prices this variant's product. Otherwise we fall back to the
 * retail price with no MOQ — so a B2B salon ordering an item their tier
 * doesn't cover simply pays base price, rather than being blocked.
 */
export function resolveUnitPrice(
  pricing: VariantPricing,
  mode: PricingMode,
): ResolvedLinePrice {
  const hasWholesale =
    mode === "WHOLESALE" &&
    pricing.wholesalePrice != null &&
    pricing.moq != null;

  if (hasWholesale) {
    return {
      variantId: pricing.variantId,
      unitPrice: toDecimal(pricing.wholesalePrice!),
      mode: "WHOLESALE",
      moq: pricing.moq!,
    };
  }

  return {
    variantId: pricing.variantId,
    unitPrice: toDecimal(pricing.retailPrice),
    mode: "RETAIL",
    moq: 1,
  };
}

/** Map a CustomerType to its pricing mode. */
export function pricingModeForCustomer(
  customerType: "RETAIL" | "B2B_SALON",
): PricingMode {
  return customerType === "B2B_SALON" ? "WHOLESALE" : "RETAIL";
}

export interface MoqViolation {
  variantId: string;
  quantity: number;
  moq: number;
}

/**
 * Check a quantity against a resolved line's MOQ. Returns a violation when
 * a wholesale line is below its minimum, else null. Retail lines (moq = 1)
 * can never violate.
 */
export function checkMoq(
  resolved: ResolvedLinePrice,
  quantity: number,
): MoqViolation | null {
  if (resolved.mode === "WHOLESALE" && quantity < resolved.moq) {
    return { variantId: resolved.variantId, quantity, moq: resolved.moq };
  }
  return null;
}
