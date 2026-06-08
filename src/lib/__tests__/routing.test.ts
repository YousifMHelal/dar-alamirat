import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  haversineKm,
  rankByDistance,
  routeOrder,
  type StockMatrix,
  type WarehouseGeo,
} from "../routing";

// Real seeded warehouse coordinates (see prisma/seed.ts).
const WAREHOUSES: WarehouseGeo[] = [
  { id: "jed-c", name: "Jeddah Central", code: "JED-C", city: "Jeddah", latitude: 21.5433, longitude: 39.1728 },
  { id: "ruh-d", name: "Riyadh Distribution", code: "RUH-D", city: "Riyadh", latitude: 24.7743, longitude: 46.7386 },
  { id: "dmm-e", name: "Eastern Region", code: "DMM-E", city: "Dammam", latitude: 26.4207, longitude: 50.0888 },
  { id: "jed-s", name: "Jeddah Branch Showroom", code: "JED-S", city: "Jeddah", latitude: 21.5826, longitude: 39.1653 },
];

describe("haversineKm", () => {
  it("is zero for identical points", () => {
    assert.equal(haversineKm({ latitude: 21.5, longitude: 39.1 }, { latitude: 21.5, longitude: 39.1 }), 0);
  });

  it("matches a known Jeddah→Riyadh great-circle distance (~847 km)", () => {
    // Jeddah Central → Riyadh Distribution. Authoritative value ≈ 846 km.
    const d = haversineKm(WAREHOUSES[0], WAREHOUSES[1]);
    assert.ok(Math.abs(d - 846) < 10, `expected ~846 km, got ${d.toFixed(1)}`);
  });

  it("is symmetric", () => {
    const a = haversineKm(WAREHOUSES[0], WAREHOUSES[2]);
    const b = haversineKm(WAREHOUSES[2], WAREHOUSES[0]);
    assert.ok(Math.abs(a - b) < 1e-9);
  });

  it("Riyadh→Dammam (~383 km) is much shorter than Riyadh→Jeddah", () => {
    const riyadhDammam = haversineKm(WAREHOUSES[1], WAREHOUSES[2]);
    const riyadhJeddah = haversineKm(WAREHOUSES[1], WAREHOUSES[0]);
    assert.ok(Math.abs(riyadhDammam - 383) < 10, `expected ~383 km, got ${riyadhDammam.toFixed(1)}`);
    assert.ok(riyadhDammam < riyadhJeddah);
  });
});

describe("rankByDistance", () => {
  it("ranks a Jeddah customer's two Jeddah warehouses ahead of Riyadh/Dammam", () => {
    const jeddahCustomer = { latitude: 21.4858, longitude: 39.1925 };
    const ranked = rankByDistance(jeddahCustomer, WAREHOUSES);
    const cities = ranked.map((r) => r.warehouse.city);
    assert.deepEqual(cities.slice(0, 2).sort(), ["Jeddah", "Jeddah"]);
    assert.equal(cities[cities.length - 1], "Dammam");
  });
});

describe("routeOrder", () => {
  const jeddahCustomer = { latitude: 21.4858, longitude: 39.1925 };

  it("routes to the nearest warehouse when it has all stock (no split)", () => {
    const stock: StockMatrix = {
      "jed-c": { v1: 100, v2: 100 },
      "jed-s": { v1: 100, v2: 100 },
      "ruh-d": { v1: 100, v2: 100 },
      "dmm-e": { v1: 100, v2: 100 },
    };
    const result = routeOrder(jeddahCustomer, WAREHOUSES, [
      { variantId: "v1", quantity: 5 },
      { variantId: "v2", quantity: 3 },
    ], stock);

    assert.equal(result.split, false);
    assert.equal(result.shipments.length, 1);
    assert.equal(result.assignedWarehouse.city, "Jeddah");
    assert.equal(result.unfulfillable.length, 0);
  });

  it("picks the nearest warehouse that has ALL items, skipping a closer short one", () => {
    // jed-s is nominally closest-ish, but lacks v2. jed-c has both.
    const stock: StockMatrix = {
      "jed-s": { v1: 100, v2: 0 },
      "jed-c": { v1: 100, v2: 100 },
      "ruh-d": { v1: 100, v2: 100 },
      "dmm-e": { v1: 100, v2: 100 },
    };
    const result = routeOrder(jeddahCustomer, WAREHOUSES, [
      { variantId: "v1", quantity: 5 },
      { variantId: "v2", quantity: 3 },
    ], stock);
    assert.equal(result.split, false);
    assert.equal(result.assignedWarehouse.id, "jed-c");
  });

  it("splits across warehouses when no single one covers everything", () => {
    // No warehouse has both v1 AND v2. Jeddah warehouses have v1; Dammam v2.
    const stock: StockMatrix = {
      "jed-c": { v1: 100, v2: 0 },
      "jed-s": { v1: 100, v2: 0 },
      "ruh-d": { v1: 0, v2: 0 },
      "dmm-e": { v1: 0, v2: 100 },
    };
    const result = routeOrder(jeddahCustomer, WAREHOUSES, [
      { variantId: "v1", quantity: 5 },
      { variantId: "v2", quantity: 3 },
    ], stock);

    assert.equal(result.split, true);
    assert.equal(result.shipments.length, 2);
    // Nearest shipment (Jeddah) is the assigned warehouse.
    assert.equal(result.assignedWarehouse.city, "Jeddah");
    // v1 from a Jeddah warehouse, v2 from Dammam.
    const v2Shipment = result.shipments.find((s) => s.warehouse.id === "dmm-e");
    assert.ok(v2Shipment);
    assert.deepEqual(v2Shipment!.lines.map((l) => l.variantId), ["v2"]);
    assert.equal(result.unfulfillable.length, 0);
  });

  it("reports lines that no warehouse can fulfil", () => {
    const stock: StockMatrix = {
      "jed-c": { v1: 100 },
      "jed-s": { v1: 100 },
      "ruh-d": { v1: 100 },
      "dmm-e": { v1: 100 },
    };
    const result = routeOrder(jeddahCustomer, WAREHOUSES, [
      { variantId: "v1", quantity: 5 },
      { variantId: "ghost", quantity: 2 },
    ], stock);
    assert.equal(result.unfulfillable.length, 1);
    assert.equal(result.unfulfillable[0].variantId, "ghost");
  });
});
