/**
 * Order routing — geo nearest-warehouse assignment and order splitting.
 *
 * These are PURE functions (no Prisma, no IO) so they're trivially
 * unit-testable and the distance math can be spot-checked in isolation.
 * The server action in lib/orders feeds them plain data (customer coords,
 * warehouse coords, a stock matrix) and persists the result.
 *
 * AC#3: an order is auto-routed to the NEAREST warehouse that can fulfil
 * it. "Nearest" is great-circle (haversine) distance from the customer to
 * each warehouse. If no single warehouse stocks every line, the order is
 * split into one shipment per warehouse, each warehouse chosen greedily by
 * proximity.
 */

const EARTH_RADIUS_KM = 6371;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two lat/lng points, in kilometres.
 *
 * Haversine formula:
 *   a = sin²(Δφ/2) + cos φ₁ · cos φ₂ · sin²(Δλ/2)
 *   d = 2R · atan2(√a, √(1−a))
 * where φ is latitude, λ is longitude (both in radians) and R is Earth's
 * mean radius. Accurate to well within a kilometre at KSA scale — more
 * than enough to rank warehouses by proximity.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface WarehouseGeo extends GeoPoint {
  id: string;
  name: string;
  code: string;
  city: string;
}

/** A requested line: a variant and how many units the customer wants. */
export interface RoutingLine {
  variantId: string;
  quantity: number;
}

/**
 * Stock matrix: stock[warehouseId][variantId] = quantityOnHand. A missing
 * entry is treated as zero stock.
 */
export type StockMatrix = Record<string, Record<string, number>>;

function stockOf(stock: StockMatrix, warehouseId: string, variantId: string): number {
  return stock[warehouseId]?.[variantId] ?? 0;
}

/** Warehouses sorted nearest-first relative to a customer location. */
export function rankByDistance(
  customer: GeoPoint,
  warehouses: WarehouseGeo[],
): Array<{ warehouse: WarehouseGeo; distanceKm: number }> {
  return warehouses
    .map((warehouse) => ({ warehouse, distanceKm: haversineKm(customer, warehouse) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/** One physical shipment: which warehouse fulfils which lines. */
export interface ShipmentPlan {
  warehouse: WarehouseGeo;
  distanceKm: number;
  lines: RoutingLine[];
}

export interface RoutingResult {
  /** The order's primary assigned warehouse (nearest that ships anything). */
  assignedWarehouse: WarehouseGeo;
  assignedDistanceKm: number;
  /** One or more shipments. Length > 1 means the order was split. */
  shipments: ShipmentPlan[];
  /** True when no single warehouse could fulfil all lines. */
  split: boolean;
  /** Lines that could not be sourced from ANY warehouse (out of stock). */
  unfulfillable: RoutingLine[];
}

/**
 * Route an order to the nearest in-stock warehouse(s).
 *
 * Strategy:
 *   1. Rank warehouses by distance to the customer (nearest first).
 *   2. If the single nearest warehouse with stock can cover EVERY line in
 *      full, route the whole order there — one shipment, no split.
 *   3. Otherwise split: walk warehouses nearest-first, and for each line
 *      assign it to the closest warehouse that has enough stock for that
 *      line. Group the assignments into one shipment per warehouse.
 *
 * The assigned warehouse (Order.assignedWarehouse) is the nearest one that
 * ends up shipping something — i.e. the first shipment's warehouse.
 *
 * Note: this plans per-line (a single line is never split across
 * warehouses); it does not partial-fill a line from two locations, which
 * keeps fulfilment and the UI simple and matches how the demo split data
 * is shaped.
 */
export function routeOrder(
  customer: GeoPoint,
  warehouses: WarehouseGeo[],
  lines: RoutingLine[],
  stock: StockMatrix,
): RoutingResult {
  const ranked = rankByDistance(customer, warehouses);
  if (ranked.length === 0) {
    throw new Error("routeOrder requires at least one warehouse");
  }
  const nearestOverall = ranked[0]!;

  // ── Step 1: can a single warehouse fulfil the whole order? ──────────
  // Check warehouses nearest-first; the first that covers every line wins.
  for (const { warehouse, distanceKm } of ranked) {
    const coversAll = lines.every(
      (line) => stockOf(stock, warehouse.id, line.variantId) >= line.quantity,
    );
    if (coversAll) {
      return {
        assignedWarehouse: warehouse,
        assignedDistanceKm: distanceKm,
        shipments: [{ warehouse, distanceKm, lines: [...lines] }],
        split: false,
        unfulfillable: [],
      };
    }
  }

  // ── Step 2: split — assign each line to its nearest in-stock warehouse.
  const byWarehouse = new Map<string, ShipmentPlan>();
  const unfulfillable: RoutingLine[] = [];

  for (const line of lines) {
    const hit = ranked.find(
      ({ warehouse }) => stockOf(stock, warehouse.id, line.variantId) >= line.quantity,
    );
    if (!hit) {
      unfulfillable.push(line);
      continue;
    }
    const existing = byWarehouse.get(hit.warehouse.id);
    if (existing) {
      existing.lines.push(line);
    } else {
      byWarehouse.set(hit.warehouse.id, {
        warehouse: hit.warehouse,
        distanceKm: hit.distanceKm,
        lines: [line],
      });
    }
  }

  // Shipments ordered nearest-first; the closest becomes the assigned one.
  const shipments = [...byWarehouse.values()].sort((a, b) => a.distanceKm - b.distanceKm);

  if (shipments.length === 0) {
    // Nothing could be sourced anywhere. Fall back to the nearest warehouse
    // as the nominal assignment so the order still has a home; the caller
    // surfaces `unfulfillable` to the user.
    return {
      assignedWarehouse: nearestOverall.warehouse,
      assignedDistanceKm: nearestOverall.distanceKm,
      shipments: [],
      split: false,
      unfulfillable,
    };
  }

  const primary = shipments[0]!;
  return {
    assignedWarehouse: primary.warehouse,
    assignedDistanceKm: primary.distanceKm,
    shipments,
    split: shipments.length > 1,
    unfulfillable,
  };
}
