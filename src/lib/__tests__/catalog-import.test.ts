import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseWorkbook, TEMPLATE_COLUMNS } from "@/lib/catalog/import/parse";

/**
 * Unit tests for the pure spreadsheet parser/validator. These exercise the
 * importer's logic with no DB — grouping, validation, and error reporting —
 * so the import server action can rely on a verified plan.
 */

const KNOWN = new Set(["skincare", "makeup"]);

/** Build an .xlsx buffer from row objects (header = TEMPLATE_COLUMNS). */
function sheet(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...TEMPLATE_COLUMNS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "products");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const validRow = (over: Record<string, unknown> = {}) => ({
  sku: "P-1",
  nameEn: "Serum",
  nameAr: "سيروم",
  brand: "Brand",
  category: "skincare",
  basePrice: "99.00",
  active: "TRUE",
  descriptionEn: "",
  descriptionAr: "",
  variantSku: "P-1-A",
  colorName: "",
  colorHex: "",
  capacity: "30ml",
  barcode: "",
  priceOverride: "",
  ...over,
});

test("parseWorkbook groups variant rows sharing a sku into one product", () => {
  const buf = sheet([
    validRow({ variantSku: "P-1-A", capacity: "30ml" }),
    validRow({ variantSku: "P-1-B", capacity: "50ml" }),
  ]);
  const r = parseWorkbook(buf, KNOWN);
  assert.equal(r.errors.length, 0);
  assert.equal(r.products.length, 1);
  assert.equal(r.products[0]!.variants.length, 2);
});

test("parseWorkbook rejects an unknown category slug", () => {
  const buf = sheet([validRow({ category: "nope" })]);
  const r = parseWorkbook(buf, KNOWN);
  assert.equal(r.products.length, 0);
  assert.ok(r.errors.some((e) => e.message === "categoryUnknown"));
});

test("parseWorkbook flags an invalid base price and bad hex", () => {
  const buf = sheet([validRow({ basePrice: "abc", colorHex: "zzz" })]);
  const r = parseWorkbook(buf, KNOWN);
  assert.ok(r.errors.some((e) => e.message === "basePriceInvalid"));
  assert.ok(r.errors.some((e) => e.message === "hexInvalid"));
});

test("parseWorkbook catches a duplicate variantSku within the sheet", () => {
  const buf = sheet([
    validRow({ sku: "P-1", variantSku: "DUP" }),
    validRow({ sku: "P-2", variantSku: "DUP" }),
  ]);
  const r = parseWorkbook(buf, KNOWN);
  assert.ok(r.errors.some((e) => e.message === "variantSkuDuplicate"));
});

test("parseWorkbook flags conflicting product fields across a shared sku", () => {
  const buf = sheet([
    validRow({ sku: "P-1", nameEn: "Serum", variantSku: "P-1-A" }),
    validRow({ sku: "P-1", nameEn: "Different", variantSku: "P-1-B" }),
  ]);
  const r = parseWorkbook(buf, KNOWN);
  assert.ok(r.errors.some((e) => e.message === "skuConflict"));
});

test("parseWorkbook reports missing required columns", () => {
  // Build a sheet missing the variantSku column entirely.
  const ws = XLSX.utils.json_to_sheet([{ sku: "P-1", nameEn: "x", nameAr: "ص", brand: "B", category: "skincare", basePrice: "1" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "products");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const r = parseWorkbook(buf, KNOWN);
  assert.ok(r.errors.some((e) => e.message === "missingColumn"));
});

test("parseWorkbook defaults blank active to true and reads priceOverride", () => {
  const buf = sheet([validRow({ active: "", priceOverride: "129.50" })]);
  const r = parseWorkbook(buf, KNOWN);
  assert.equal(r.products[0]!.active, true);
  assert.equal(r.products[0]!.variants[0]!.priceOverride, "129.50");
});
