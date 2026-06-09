"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { computeVat, lineTotal as computeLineTotal, sumLineTotals } from "@/lib/money";
import {
  checkMoq,
  pricingModeForCustomer,
  resolveUnitPrice,
  type VariantPricing,
} from "@/lib/pricing";
import { routeOrder, type StockMatrix, type WarehouseGeo } from "@/lib/routing";
import {
  createOrderSchema,
  newCustomerSchema,
  normalisePhone,
  phoneLookupSchema,
  type CreateOrderInput,
  type NewCustomerInput,
} from "./schema";

/**
 * Server actions for the Orders module. Every mutation:
 *   - asserts an authenticated user,
 *   - validates input with Zod (authoritative, mirrors the client),
 *   - returns a discriminated `{ ok }` union (never throws to the client),
 *   - and writes through the pure lib functions in lib/{pricing,routing,money}.
 *
 * createOrder is the hero: it resolves pricing (AC#2), enforces MOQ (AC#2),
 * geo-routes to the nearest in-stock warehouse with split support (AC#3),
 * and persists Order + items + payment + shipments + inventory decrements
 * in a single transaction.
 */

// ── AC#1: phone lookup → CRM profile ──────────────────────────────────

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  type: "RETAIL" | "B2B_SALON";
  city: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  crmNotes: string | null;
  loyaltyPoints: number;
  pricingTierId: string | null;
  pricingTierName: string | null;
  vatNumber: string | null;
}

export type LookupResult =
  | { ok: true; found: true; customer: CustomerProfile }
  | { ok: true; found: false }
  | { ok: false; error: string };

/**
 * Look up a customer by phone and return their full CRM profile so the
 * order form can auto-populate. Phone is matched on a normalised form so
 * "+966 50…" and "+96650…" both hit.
 */
export async function lookupCustomerByPhone(phone: string): Promise<LookupResult> {
  await requireUser();
  const parsed = phoneLookupSchema.safeParse({ phone });
  if (!parsed.success) return { ok: false, error: "phoneInvalid" };

  const normalised = normalisePhone(parsed.data.phone);
  // Stored phones are already normalised (no spaces); match exact then a
  // contains-fallback so partial entries still resolve a unique customer.
  const customer =
    (await prisma.customer.findUnique({
      where: { phone: normalised },
      include: { pricingTier: { select: { name: true } } },
    })) ??
    (await prisma.customer.findFirst({
      where: { phone: { contains: normalised } },
      include: { pricingTier: { select: { name: true } } },
    }));

  if (!customer) return { ok: true, found: false };

  return {
    ok: true,
    found: true,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      type: customer.type,
      city: customer.city,
      addressLine: customer.addressLine,
      latitude: customer.latitude,
      longitude: customer.longitude,
      crmNotes: customer.crmNotes,
      loyaltyPoints: customer.loyaltyPoints,
      pricingTierId: customer.pricingTierId,
      pricingTierName: customer.pricingTier?.name ?? null,
      vatNumber: customer.vatNumber ?? null,
    },
  };
}

// ── AC#1: inline customer creation ────────────────────────────────────

export type CreateCustomerResult =
  | { ok: true; customer: CustomerProfile }
  | { ok: false; error: string };

export async function createCustomer(
  input: NewCustomerInput,
): Promise<CreateCustomerResult> {
  await requireUser();
  const parsed = newCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const data = parsed.data;
  const phone = normalisePhone(data.phone);

  const existing = await prisma.customer.findUnique({ where: { phone } });
  if (existing) return { ok: false, error: "phoneTaken" };

  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      phone,
      email: data.email || null,
      type: data.type,
      city: data.city,
      addressLine: data.addressLine,
      latitude: data.latitude,
      longitude: data.longitude,
      // Only B2B salons carry a pricing tier and VAT number.
      pricingTierId: data.type === "B2B_SALON" ? (data.pricingTierId ?? null) : null,
      vatNumber: data.type === "B2B_SALON" ? (data.vatNumber ?? null) : null,
    },
    include: { pricingTier: { select: { name: true } } },
  });

  return {
    ok: true,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      type: customer.type,
      city: customer.city,
      addressLine: customer.addressLine,
      latitude: customer.latitude,
      longitude: customer.longitude,
      crmNotes: customer.crmNotes,
      loyaltyPoints: customer.loyaltyPoints,
      pricingTierId: customer.pricingTierId,
      pricingTierName: customer.pricingTier?.name ?? null,
      vatNumber: customer.vatNumber ?? null,
    },
  };
}

// ── Variant search (picker) + per-customer price preview ──────────────

export interface VariantSearchItem {
  variantId: string;
  productId: string;
  label: string; // brand + product + variant attrs
  sku: string;
  colorName: string | null;
  colorHex: string | null;
  capacity: string | null;
  /** Unit price for THIS customer (wholesale if applicable, else retail). */
  unitPrice: string;
  mode: "RETAIL" | "WHOLESALE";
  moq: number;
  /** Total stock across all warehouses (for an at-a-glance availability). */
  totalStock: number;
}

/**
 * Search variants by product name / brand / sku, and resolve each result's
 * price + MOQ for the given customer. customerId is optional — without it
 * (no customer chosen yet) prices show as retail.
 */
export async function searchVariants(
  query: string,
  customerId?: string,
): Promise<{ ok: true; items: VariantSearchItem[] } | { ok: false; error: string }> {
  await requireUser();
  const q = query.trim();
  if (q.length < 2) return { ok: true, items: [] };

  // Determine the customer's pricing mode + tier (drives wholesale lookup).
  let mode: "RETAIL" | "WHOLESALE" = "RETAIL";
  let pricingTierId: string | null = null;
  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { type: true, pricingTierId: true },
    });
    if (customer) {
      mode = pricingModeForCustomer(customer.type);
      pricingTierId = customer.pricingTierId;
    }
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      product: { active: true },
      OR: [
        { product: { nameEn: { contains: q, mode: "insensitive" } } },
        { product: { nameAr: { contains: q } } },
        { product: { brand: { contains: q, mode: "insensitive" } } },
        { variantSku: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 20,
    select: {
      id: true,
      productId: true,
      variantSku: true,
      colorName: true,
      colorHex: true,
      capacity: true,
      priceOverride: true,
      product: { select: { nameEn: true, brand: true, basePrice: true } },
      inventoryItems: { select: { quantityOnHand: true } },
    },
  });

  // Bulk-load tier prices for the matched products (one query, not N).
  const tierPriceByProduct = new Map<string, { wholesale: Prisma.Decimal; moq: number }>();
  if (mode === "WHOLESALE" && pricingTierId) {
    const productIds = [...new Set(variants.map((v) => v.productId))];
    const tierPrices = await prisma.tierPrice.findMany({
      where: { pricingTierId, productId: { in: productIds } },
      select: { productId: true, wholesalePrice: true, moq: true },
    });
    for (const tp of tierPrices) {
      if (tp.productId) {
        tierPriceByProduct.set(tp.productId, { wholesale: tp.wholesalePrice, moq: tp.moq });
      }
    }
  }

  const items: VariantSearchItem[] = variants.map((v) => {
    const tier = tierPriceByProduct.get(v.productId);
    const pricing: VariantPricing = {
      variantId: v.id,
      productId: v.productId,
      retailPrice: v.priceOverride ?? v.product.basePrice,
      wholesalePrice: tier?.wholesale ?? null,
      moq: tier?.moq ?? null,
    };
    const resolved = resolveUnitPrice(pricing, mode);
    const totalStock = v.inventoryItems.reduce((s, i) => s + i.quantityOnHand, 0);
    const attrs = [v.product.brand, v.product.nameEn, v.capacity, v.colorName]
      .filter(Boolean)
      .join(" · ");
    return {
      variantId: v.id,
      productId: v.productId,
      label: attrs,
      sku: v.variantSku,
      colorName: v.colorName,
      colorHex: v.colorHex,
      capacity: v.capacity,
      unitPrice: resolved.unitPrice.toFixed(2),
      mode: resolved.mode,
      moq: resolved.moq,
      totalStock,
    };
  });

  return { ok: true, items };
}

// ── AC#2 + AC#3: create order (the hero transaction) ──────────────────

export interface ShipmentSummary {
  warehouseName: string;
  warehouseCode: string;
  city: string;
  distanceKm: number;
  variantCount: number;
}

export type CreateOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      assignedWarehouse: { name: string; code: string; city: string; distanceKm: number };
      split: boolean;
      shipments: ShipmentSummary[];
      pointsRedeemed: number;
      pointsDiscount: string;
    }
  | { ok: false; error: string; moqViolations?: Array<{ variantId: string; quantity: number; moq: number }> };

/** Generate the next DA-2026-XXXX order number from the current max. */
async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.order.findFirst({
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  const lastN = last ? Number(last.orderNumber.split("-").pop()) : 0;
  return `DA-2026-${String(lastN + 1).padStart(4, "0")}`;
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  await requireUser();
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const { customerId, lines, paymentMethod, redeemPoints } = parsed.data;

  // ── Load the customer (mode + coords for routing). ──────────────────
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, type: true, latitude: true, longitude: true, pricingTierId: true, loyaltyPoints: true },
  });
  if (!customer) return { ok: false, error: "customerNotFound" };
  const mode = pricingModeForCustomer(customer.type);

  // ── B2B credit limit pre-check (before expensive routing). ──────────
  // We need the order total to compare against the limit. Compute a quick
  // subtotal here; the full VAT / points / routing logic runs later inside
  // the transaction only if the credit gate passes.
  if (paymentMethod === "B2B_CREDIT") {
    const creditAccount = await prisma.creditAccount.findUnique({
      where: { customerId },
      select: { creditLimit: true, balance: true },
    });
    if (creditAccount) {
      // Estimate pre-VAT subtotal from raw input prices to keep this cheap.
      const variantIdsForCheck = lines.map((l) => l.variantId);
      const variantsForCheck = await prisma.productVariant.findMany({
        where: { id: { in: variantIdsForCheck } },
        select: { id: true, productId: true, priceOverride: true, product: { select: { basePrice: true } } },
      });
      const variantMapForCheck = new Map(variantsForCheck.map((v) => [v.id, v]));
      const estimatedSubtotal = lines.reduce((sum, l) => {
        const v = variantMapForCheck.get(l.variantId);
        const price = v ? Number(v.priceOverride ?? v.product.basePrice) : 0;
        return sum + price * l.quantity;
      }, 0);
      const estimatedTotal = new Prisma.Decimal((estimatedSubtotal * 1.15).toFixed(2));
      const projectedBalance = creditAccount.balance.add(estimatedTotal);
      if (projectedBalance.greaterThan(creditAccount.creditLimit)) {
        return { ok: false, error: "credit_limit_exceeded" };
      }
    }
  }

  // ── Load variants + their base/override prices. ─────────────────────
  const variantIds = lines.map((l) => l.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, productId: true, priceOverride: true, product: { select: { basePrice: true } } },
  });
  const variantById = new Map(variants.map((v) => [v.id, v]));
  if (variants.length !== new Set(variantIds).size) {
    return { ok: false, error: "variantNotFound" };
  }

  // ── Tier prices for wholesale customers (bulk). ─────────────────────
  const tierPriceByProduct = new Map<string, { wholesale: Prisma.Decimal; moq: number }>();
  if (mode === "WHOLESALE" && customer.pricingTierId) {
    const productIds = [...new Set(variants.map((v) => v.productId))];
    const tierPrices = await prisma.tierPrice.findMany({
      where: { pricingTierId: customer.pricingTierId, productId: { in: productIds } },
      select: { productId: true, wholesalePrice: true, moq: true },
    });
    for (const tp of tierPrices) {
      if (tp.productId) tierPriceByProduct.set(tp.productId, { wholesale: tp.wholesalePrice, moq: tp.moq });
    }
  }

  // ── AC#2: resolve price per line, enforce MOQ, build line totals. ───
  const moqViolations: Array<{ variantId: string; quantity: number; moq: number }> = [];
  const resolvedLines = lines.map((line) => {
    const v = variantById.get(line.variantId)!;
    const tier = tierPriceByProduct.get(v.productId);
    const resolved = resolveUnitPrice(
      {
        variantId: v.id,
        productId: v.productId,
        retailPrice: v.priceOverride ?? v.product.basePrice,
        wholesalePrice: tier?.wholesale ?? null,
        moq: tier?.moq ?? null,
      },
      mode,
    );
    const violation = checkMoq(resolved, line.quantity);
    if (violation) moqViolations.push(violation);
    return {
      variantId: v.id,
      quantity: line.quantity,
      unitPrice: resolved.unitPrice,
      lineTotal: computeLineTotal(resolved.unitPrice, line.quantity),
    };
  });

  if (moqViolations.length > 0) {
    return { ok: false, error: "moqViolation", moqViolations };
  }

  // ── VAT math (15%). ─────────────────────────────────────────────────
  const subtotal = sumLineTotals(resolvedLines.map((l) => l.lineTotal));
  const { vatAmount, total: totalBeforePoints } = computeVat(subtotal);

  // ── Loyalty redemption (100 pts = 10 SAR, applied after VAT). ───────
  // Only allow redemption if the customer actually has ≥ 100 points.
  const canRedeem = redeemPoints && customer.loyaltyPoints >= 100;
  // Points used = all available points rounded down to the nearest 100-block.
  const pointsRedeemed = canRedeem ? Math.floor(customer.loyaltyPoints / 100) * 100 : 0;
  // Discount = 10 SAR per 100 points, capped at the post-VAT total so total >= 0.
  const pointsDiscountRaw = (pointsRedeemed / 100) * 10;
  const pointsDiscount = new Prisma.Decimal(Math.min(pointsDiscountRaw, Number(totalBeforePoints)).toFixed(2));
  const total = new Prisma.Decimal((Number(totalBeforePoints) - Number(pointsDiscount)).toFixed(2));

  // ── AC#3: geo-route to nearest in-stock warehouse (+ split). ────────
  const warehouses = await prisma.warehouse.findMany({
    select: { id: true, name: true, code: true, city: true, latitude: true, longitude: true },
  });
  const warehouseGeo: WarehouseGeo[] = warehouses;

  const inventory = await prisma.inventoryItem.findMany({
    where: { variantId: { in: variantIds } },
    select: { warehouseId: true, variantId: true, quantityOnHand: true },
  });
  const stock: StockMatrix = {};
  for (const row of inventory) {
    (stock[row.warehouseId] ??= {})[row.variantId] = row.quantityOnHand;
  }

  const routing = routeOrder(
    { latitude: customer.latitude, longitude: customer.longitude },
    warehouseGeo,
    resolvedLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    stock,
  );

  if (routing.unfulfillable.length > 0) {
    return { ok: false, error: "outOfStock" };
  }

  // ── Persist everything atomically. ──────────────────────────────────
  const created = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx);

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        type: mode === "WHOLESALE" ? "WHOLESALE" : "RETAIL",
        status: "PENDING",
        subtotal,
        vatAmount,
        total,
        pointsRedeemed,
        pointsDiscount,
        assignedWarehouseId: routing.assignedWarehouse.id,
        items: {
          createMany: {
            data: resolvedLines.map((l) => ({
              variantId: l.variantId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
        // One PENDING payment for the order total.
        payments: {
          create: { method: paymentMethod, amount: total, status: "PENDING" },
        },
        // One shipment per warehouse the routing chose (split → multiple).
        shipments: {
          create: routing.shipments.map((s) => ({
            warehouseId: s.warehouse.id,
            // Carrier is a required field; default to ARAMEX at creation.
            carrier: "ARAMEX" as const,
            status: "PENDING" as const,
          })),
        },
      },
      select: {
        id: true,
        orderNumber: true,
        shipments: { select: { id: true, warehouseId: true } },
        items: { select: { id: true, variantId: true } },
      },
    });

    // Link each OrderItem to its Shipment via ShipmentItem — one batch per shipment.
    for (const routedShipment of routing.shipments) {
      const createdShipment = order.shipments.find(
        (s) => s.warehouseId === routedShipment.warehouse.id,
      );
      if (!createdShipment) continue;
      const shipmentItemData = routedShipment.lines.flatMap((line) => {
        const orderItem = order.items.find((i) => i.variantId === line.variantId);
        if (!orderItem) return [];
        return [{ shipmentId: createdShipment.id, orderItemId: orderItem.id, quantity: line.quantity }];
      });
      if (shipmentItemData.length) {
        await tx.shipmentItem.createMany({ data: shipmentItemData });
      }
    }

    // Decrement inventory — fire all updates in parallel to avoid serial round-trips.
    await Promise.all(
      routing.shipments.flatMap((shipment) =>
        shipment.lines.map((line) =>
          tx.inventoryItem.update({
            where: {
              warehouseId_variantId: {
                warehouseId: shipment.warehouse.id,
                variantId: line.variantId,
              },
            },
            data: { quantityOnHand: { decrement: line.quantity } },
          }),
        ),
      ),
    );

    // Atomically deduct redeemed loyalty points from the customer.
    if (pointsRedeemed > 0) {
      await tx.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { decrement: pointsRedeemed } },
      });
    }

    return { id: order.id, orderNumber: order.orderNumber };
  });

  revalidatePath("/orders");

  return {
    ok: true,
    orderId: created.id,
    orderNumber: created.orderNumber,
    assignedWarehouse: {
      name: routing.assignedWarehouse.name,
      code: routing.assignedWarehouse.code,
      city: routing.assignedWarehouse.city,
      distanceKm: Math.round(routing.assignedDistanceKm),
    },
    split: routing.split,
    shipments: routing.shipments.map((s) => ({
      warehouseName: s.warehouse.name,
      warehouseCode: s.warehouse.code,
      city: s.warehouse.city,
      distanceKm: Math.round(s.distanceKm),
      variantCount: s.lines.length,
    })),
    pointsRedeemed,
    pointsDiscount: pointsDiscount.toFixed(2),
  };
}

/** Pricing tiers for the inline new-customer form (B2B tier picker). */
export async function listPricingTiers(): Promise<
  Array<{ id: string; name: string }>
> {
  await requireUser();
  return prisma.pricingTier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}
