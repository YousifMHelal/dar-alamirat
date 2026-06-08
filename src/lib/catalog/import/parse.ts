import * as XLSX from "xlsx";

/**
 * Spreadsheet parsing + row validation for the bulk catalog importer.
 *
 * This module is deliberately PURE — no DB, no auth, no Next APIs — so it
 * can be unit-tested and reused. The import server action handles auth,
 * reads the upload into a Buffer, calls `parseWorkbook` here to get a
 * validated plan, then performs the upserts. Keeping the parse/validate
 * logic out of the route/action is a project convention.
 *
 * Sheet shape: ONE ROW PER VARIANT. Rows sharing a `sku` describe the same
 * product (its product-level columns must agree); each row's `variantSku`
 * identifies the variant. On import, products upsert by `sku` and variants
 * upsert by `variantSku`.
 */

/** Canonical column order — also drives the downloadable template. */
export const TEMPLATE_COLUMNS = [
  "sku",
  "nameEn",
  "nameAr",
  "brand",
  "category", // category slug
  "basePrice",
  "active", // TRUE/FALSE/1/0/yes/no
  "descriptionEn",
  "descriptionAr",
  "variantSku",
  "colorName",
  "colorHex",
  "capacity",
  "barcode",
  "priceOverride",
] as const;

export type TemplateColumn = (typeof TEMPLATE_COLUMNS)[number];

/** A single validation problem tied to a sheet row + column. */
export interface RowError {
  /** 1-based row number as it appears in the spreadsheet (incl. header). */
  row: number;
  column?: TemplateColumn | string;
  message: string; // i18n key under catalog.import.errors.*
}

/** A validated variant ready to upsert. */
export interface ParsedVariant {
  variantSku: string;
  colorName: string | null;
  colorHex: string | null;
  capacity: string | null;
  barcode: string | null;
  priceOverride: string | null; // decimal string or null
}

/** A validated product (grouped from one or more variant rows). */
export interface ParsedProduct {
  sku: string;
  nameEn: string;
  nameAr: string;
  brand: string;
  categorySlug: string;
  basePrice: string; // decimal string
  active: boolean;
  descriptionEn: string | null;
  descriptionAr: string | null;
  variants: ParsedVariant[];
}

export interface ParseResult {
  /** Products that passed validation and can be imported. */
  products: ParsedProduct[];
  /** Per-row errors (a row with any error is excluded from `products`). */
  errors: RowError[];
  /** Total data rows read (excluding the header). */
  totalRows: number;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

/** Coerce a cell to a trimmed string ("" for null/undefined). */
function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** Parse a boolean-ish cell. Empty defaults to true (active). */
function parseBool(v: unknown): boolean {
  const s = str(v).toLowerCase();
  if (s === "") return true;
  return ["true", "1", "yes", "y", "نعم"].includes(s);
}

/** Normalise a money cell to a 2dp decimal string, or null if invalid/empty. */
function moneyOrNull(v: unknown): { value: string | null; invalid: boolean } {
  const s = str(v);
  if (s === "") return { value: null, invalid: false };
  if (!MONEY_RE.test(s)) return { value: null, invalid: true };
  return { value: s, invalid: false };
}

/**
 * Parse an uploaded .xlsx buffer into a validated import plan. Reads the
 * first worksheet; expects the TEMPLATE_COLUMNS header (case-insensitive,
 * order-independent). Validates each row, groups variant rows into products,
 * and flags conflicting product-level fields across a shared sku.
 *
 * @param knownCategorySlugs slugs that exist in the DB — rows referencing an
 *        unknown category are rejected (we never invent categories on import).
 */
export function parseWorkbook(
  buffer: Buffer | ArrayBuffer,
  knownCategorySlugs: Set<string>,
): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { products: [], errors: [{ row: 0, message: "noSheet" }], totalRows: 0 };
  }
  const sheet = wb.Sheets[sheetName]!;

  // Header-keyed rows; `defval: ""` keeps empty cells as "" so column access
  // is stable. `raw: false` formats numbers/dates to strings consistently.
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    return { products: [], errors: [{ row: 0, message: "empty" }], totalRows: 0 };
  }

  // Build a case-insensitive header → canonical column map.
  const firstRow = rawRows[0]!;
  const headerMap = new Map<string, TemplateColumn>();
  for (const key of Object.keys(firstRow)) {
    const match = TEMPLATE_COLUMNS.find((c) => c.toLowerCase() === key.trim().toLowerCase());
    if (match) headerMap.set(key, match);
  }

  // Required headers must all be present.
  const requiredHeaders: TemplateColumn[] = [
    "sku",
    "nameEn",
    "nameAr",
    "brand",
    "category",
    "basePrice",
    "variantSku",
  ];
  const presentCanonical = new Set(headerMap.values());
  const missing = requiredHeaders.filter((h) => !presentCanonical.has(h));
  if (missing.length > 0) {
    return {
      products: [],
      errors: missing.map((m) => ({ row: 1, column: m, message: "missingColumn" })),
      totalRows: rawRows.length,
    };
  }

  /** Read a canonical column out of a raw row via the header map. */
  const cell = (raw: Record<string, unknown>, col: TemplateColumn): unknown => {
    for (const [key, canon] of headerMap) {
      if (canon === col) return raw[key];
    }
    return "";
  };

  const errors: RowError[] = [];
  // Group rows by product sku while validating each row.
  const grouped = new Map<string, ParsedProduct>();
  // Track variant SKUs seen across the whole sheet to catch duplicates.
  const seenVariantSkus = new Map<string, number>();

  rawRows.forEach((raw, idx) => {
    // +2: 1 for the header row, 1 for 1-based indexing.
    const rowNum = idx + 2;
    const rowErrors: RowError[] = [];

    const sku = str(cell(raw, "sku"));
    const nameEn = str(cell(raw, "nameEn"));
    const nameAr = str(cell(raw, "nameAr"));
    const brand = str(cell(raw, "brand"));
    const categorySlug = str(cell(raw, "category")).toLowerCase();
    const variantSku = str(cell(raw, "variantSku"));

    if (!sku) rowErrors.push({ row: rowNum, column: "sku", message: "skuRequired" });
    if (!nameEn) rowErrors.push({ row: rowNum, column: "nameEn", message: "nameEnRequired" });
    if (!nameAr) rowErrors.push({ row: rowNum, column: "nameAr", message: "nameArRequired" });
    if (!brand) rowErrors.push({ row: rowNum, column: "brand", message: "brandRequired" });
    if (!variantSku)
      rowErrors.push({ row: rowNum, column: "variantSku", message: "variantSkuRequired" });

    if (!categorySlug) {
      rowErrors.push({ row: rowNum, column: "category", message: "categoryRequired" });
    } else if (!knownCategorySlugs.has(categorySlug)) {
      rowErrors.push({ row: rowNum, column: "category", message: "categoryUnknown" });
    }

    const base = moneyOrNull(cell(raw, "basePrice"));
    if (base.value === null || base.invalid) {
      rowErrors.push({ row: rowNum, column: "basePrice", message: "basePriceInvalid" });
    }

    const override = moneyOrNull(cell(raw, "priceOverride"));
    if (override.invalid) {
      rowErrors.push({ row: rowNum, column: "priceOverride", message: "priceInvalid" });
    }

    const colorHex = str(cell(raw, "colorHex"));
    if (colorHex && !HEX_RE.test(colorHex)) {
      rowErrors.push({ row: rowNum, column: "colorHex", message: "hexInvalid" });
    }

    // Duplicate variantSku within the sheet.
    if (variantSku) {
      const prev = seenVariantSkus.get(variantSku.toLowerCase());
      if (prev != null) {
        rowErrors.push({ row: rowNum, column: "variantSku", message: "variantSkuDuplicate" });
      } else {
        seenVariantSkus.set(variantSku.toLowerCase(), rowNum);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    const active = parseBool(cell(raw, "active"));
    const descriptionEn = str(cell(raw, "descriptionEn")) || null;
    const descriptionAr = str(cell(raw, "descriptionAr")) || null;

    const variant: ParsedVariant = {
      variantSku,
      colorName: str(cell(raw, "colorName")) || null,
      colorHex: colorHex || null,
      capacity: str(cell(raw, "capacity")) || null,
      barcode: str(cell(raw, "barcode")) || null,
      priceOverride: override.value,
    };

    const existing = grouped.get(sku);
    if (!existing) {
      grouped.set(sku, {
        sku,
        nameEn,
        nameAr,
        brand,
        categorySlug,
        basePrice: base.value!,
        active,
        descriptionEn,
        descriptionAr,
        variants: [variant],
      });
    } else {
      // Conflicting product-level fields across rows sharing a sku.
      if (
        existing.nameEn !== nameEn ||
        existing.nameAr !== nameAr ||
        existing.brand !== brand ||
        existing.categorySlug !== categorySlug ||
        existing.basePrice !== base.value
      ) {
        errors.push({ row: rowNum, column: "sku", message: "skuConflict" });
        return;
      }
      existing.variants.push(variant);
    }
  });

  return {
    products: [...grouped.values()],
    errors,
    totalRows: rawRows.length,
  };
}
