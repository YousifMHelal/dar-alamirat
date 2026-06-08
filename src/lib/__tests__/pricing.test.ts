import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/generated/prisma/client";
import {
  resolveUnitPrice,
  pricingModeForCustomer,
  checkMoq,
  type VariantPricing,
} from "../pricing";

const D = (n: string | number) => new Prisma.Decimal(n);

describe("pricingModeForCustomer", () => {
  it("maps B2B_SALON → WHOLESALE and RETAIL → RETAIL", () => {
    assert.equal(pricingModeForCustomer("B2B_SALON"), "WHOLESALE");
    assert.equal(pricingModeForCustomer("RETAIL"), "RETAIL");
  });
});

describe("resolveUnitPrice", () => {
  const tieredVariant: VariantPricing = {
    variantId: "v1",
    productId: "p1",
    retailPrice: D("200.00"),
    wholesalePrice: D("146.00"), // 27% off (gold tier)
    moq: 6,
  };

  it("retail customer pays retail price with moq 1", () => {
    const r = resolveUnitPrice(tieredVariant, "RETAIL");
    assert.equal(r.mode, "RETAIL");
    assert.ok(r.unitPrice.equals(D("200.00")));
    assert.equal(r.moq, 1);
  });

  it("wholesale customer pays the tier wholesale price + tier moq", () => {
    const r = resolveUnitPrice(tieredVariant, "WHOLESALE");
    assert.equal(r.mode, "WHOLESALE");
    assert.ok(r.unitPrice.equals(D("146.00")));
    assert.equal(r.moq, 6);
  });

  it("wholesale customer falls back to retail when tier doesn't price the item", () => {
    const untiered: VariantPricing = {
      variantId: "v2",
      productId: "p2",
      retailPrice: D("90.00"),
      wholesalePrice: null,
      moq: null,
    };
    const r = resolveUnitPrice(untiered, "WHOLESALE");
    assert.equal(r.mode, "RETAIL");
    assert.ok(r.unitPrice.equals(D("90.00")));
    assert.equal(r.moq, 1);
  });
});

describe("checkMoq", () => {
  const wholesale = resolveUnitPrice(
    { variantId: "v1", productId: "p1", retailPrice: D("200"), wholesalePrice: D("146"), moq: 6 },
    "WHOLESALE",
  );
  const retail = resolveUnitPrice(
    { variantId: "v1", productId: "p1", retailPrice: D("200") },
    "RETAIL",
  );

  it("flags a wholesale line below MOQ", () => {
    const v = checkMoq(wholesale, 4);
    assert.ok(v);
    assert.equal(v!.moq, 6);
    assert.equal(v!.quantity, 4);
  });

  it("passes a wholesale line at or above MOQ", () => {
    assert.equal(checkMoq(wholesale, 6), null);
    assert.equal(checkMoq(wholesale, 12), null);
  });

  it("never flags a retail line", () => {
    assert.equal(checkMoq(retail, 1), null);
  });
});
