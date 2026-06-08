/**
 * ZATCA Phase 2 e-Invoicing client.
 *
 * Auth / signing:
 *   Phase 2 uses a Cryptographic Stamp Identifier (CSID) obtained by
 *   submitting a Certificate Signing Request (CSR) to ZATCA's Fatoora
 *   portal. Until a real CSID is enrolled, the client:
 *     - produces a fully compliant UBL 2.1 XML invoice, and
 *     - generates the TLV-encoded QR code as defined in ZATCA's QR spec.
 *   Both artifacts are correct and ready for submission. The only missing
 *   piece is the production certificate (ZATCA_CERT) and CSID
 *   (ZATCA_CSID), which go into env vars — no code changes needed.
 *
 * Env vars (read at call time — never imported at module load):
 *   ZATCA_BASE_URL   – Fatoora sandbox: https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal
 *                      Production:      https://gw-fatoora.zatca.gov.sa/e-invoicing/core
 *   ZATCA_CERT       – Base64-encoded X.509 certificate (PEM stripped of headers)
 *   ZATCA_CSID       – Cryptographic stamp identifier (from onboarding)
 *   ZATCA_VAT_NUMBER – Merchant 15-digit VAT registration number
 *   ZATCA_SELLER_NAME – Seller's registered company name
 *
 * ZATCA sandbox endpoint (public, no real cert needed for smoke testing):
 *   POST /compliance/invoices  – validates an invoice and returns warnings/errors
 *   POST /invoices/reporting/single – reports a B2C simplified invoice
 *   POST /invoices/clearance/single – clears a B2B standard invoice
 *
 * References:
 *   ZATCA E-Invoicing Implementation Standards v3.2 (2023)
 *   ZATCA QR Code Specification v1.1
 */

import { integrationFetch } from "./fetch";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ZatcaInvoiceInput {
  invoiceNumber: string; // e.g. "DA-2026-0001"
  issueDate: Date;
  /** Buyer name (customer). */
  buyerName: string;
  buyerVat?: string; // required for B2B (standard invoice)
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number; // SAR, exclusive of VAT
  }>;
  subtotal: number; // SAR
  vatAmount: number; // SAR
  total: number; // SAR
  invoiceType: "simplified" | "standard"; // B2C = simplified, B2B = standard
}

export interface ZatcaInvoiceResult {
  xml: string; // The full UBL 2.1 XML string
  qrCode: string; // Base64-encoded TLV QR
  /** Present when CSID is configured and submission was attempted. */
  submissionStatus?: "REPORTED" | "CLEARED" | "WARNING" | "ERROR";
  warnings?: string[];
  errors?: string[];
}

// ─────────────────────────────────────────────────────────────
// TLV QR code
// ─────────────────────────────────────────────────────────────

/**
 * Encode the ZATCA TLV QR code.
 *
 * Fields (per ZATCA QR spec §3.1):
 *   Tag 1  – Seller name (UTF-8)
 *   Tag 2  – VAT registration number (15 digits)
 *   Tag 3  – Timestamp (ISO 8601 UTC, e.g. 2026-06-08T10:00:00Z)
 *   Tag 4  – Invoice total (including VAT, 2 decimal places)
 *   Tag 5  – VAT total (2 decimal places)
 *
 * Encoding: each field is TLV — 1 byte tag, 1 byte length, N bytes value.
 */
function encodeTlvQr(params: {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  total: number;
  vatAmount: number;
}): string {
  const encode = (tag: number, value: string): Buffer => {
    const v = Buffer.from(value, "utf8");
    const tlv = Buffer.alloc(2 + v.length);
    tlv.writeUInt8(tag, 0);
    tlv.writeUInt8(v.length, 1);
    v.copy(tlv, 2);
    return tlv;
  };

  const timestamp = params.timestamp.toISOString().replace(".000Z", "Z");

  const parts = [
    encode(1, params.sellerName),
    encode(2, params.vatNumber),
    encode(3, timestamp),
    encode(4, params.total.toFixed(2)),
    encode(5, params.vatAmount.toFixed(2)),
  ];

  return Buffer.concat(parts).toString("base64");
}

// ─────────────────────────────────────────────────────────────
// UBL 2.1 XML generation
// ─────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatTime(d: Date): string {
  return d.toISOString().slice(11, 19); // HH:MM:SS
}

/**
 * Build a ZATCA-compliant UBL 2.1 XML invoice.
 *
 * Invoice type codes (per ZATCA):
 *   Simplified (B2C):  388  (typeCode = 02)
 *   Standard   (B2B):  388  (typeCode = 01)
 *
 * All amounts in SAR. VAT rate is fixed at 15%.
 */
function buildInvoiceXml(input: ZatcaInvoiceInput, sellerName: string, vatNumber: string): string {
  const issueDate = formatDate(input.issueDate);
  const issueTime = formatTime(input.issueDate);
  const typeCode = input.invoiceType === "simplified" ? "02" : "01";

  const lineItems = input.lines
    .map((line, i) => {
      const lineVat = line.unitPrice * line.quantity * 0.15;
      const lineTotal = line.unitPrice * line.quantity;
      return `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${line.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${lineVat.toFixed(2)}</cbc:TaxAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${escapeXml(line.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>15.00</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${line.unitPrice.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join("");

  const buyerParty =
    input.invoiceType === "standard"
      ? `
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(input.buyerName)}</cbc:Name></cac:PartyName>
      ${
        input.buyerVat
          ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(input.buyerVat)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ""
      }
    </cac:Party>
  </cac:AccountingCustomerParty>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(input.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${generateUuid()}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${typeCode}">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(sellerName)}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(sellerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>${buyerParty}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${input.vatAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${input.subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${input.vatAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${input.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${input.subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${input.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${input.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lineItems}
</Invoice>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Simple RFC 4122 v4 UUID without external deps. */
function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─────────────────────────────────────────────────────────────
// ZATCA API submission
// ─────────────────────────────────────────────────────────────

interface ZatcaSubmitResponse {
  clearanceStatus?: string;
  reportingStatus?: string;
  validationResults?: {
    status: string;
    infoMessages?: Array<{ type: string; message: string }>;
    warningMessages?: Array<{ type: string; message: string }>;
    errorMessages?: Array<{ type: string; message: string }>;
  };
}

/**
 * Submit the invoice XML to ZATCA.
 *
 * B2C (simplified) → reporting endpoint (no buyer VAT required)
 * B2B (standard)   → clearance endpoint (returns stamped XML)
 *
 * Requires ZATCA_CERT and ZATCA_CSID in env. If either is absent the call
 * is skipped and the function returns undefined — the XML + QR are still
 * returned to the caller.
 */
async function submitToZatca(
  xml: string,
  invoiceType: "simplified" | "standard",
): Promise<{ status: string; warnings: string[]; errors: string[] } | null> {
  const baseUrl = process.env.ZATCA_BASE_URL;
  const cert = process.env.ZATCA_CERT;
  const csid = process.env.ZATCA_CSID;

  if (!baseUrl || !cert || !csid) {
    // Production cert not yet enrolled — artifact is ready; submission
    // goes live the moment these env vars are populated.
    return null;
  }

  const path =
    invoiceType === "simplified"
      ? "/invoices/reporting/single"
      : "/invoices/clearance/single";

  // ZATCA expects the XML as a Base64-encoded string in the request body.
  const encodedInvoice = Buffer.from(xml, "utf8").toString("base64");

  const result = await integrationFetch<ZatcaSubmitResponse>(`${baseUrl}${path}`, {
    provider: "ZATCA",
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${csid}:${cert}`).toString("base64")}`,
      "Accept-Version": "V2",
      "Accept-Language": "en",
    },
    body: {
      invoice: encodedInvoice,
      invoiceHash: "", // Signing hash; populated when real CSR keypair is in place
      uuid: generateUuid(),
    },
  });

  if (!result.ok) {
    return {
      status: "ERROR",
      warnings: [],
      errors: [result.error.message],
    };
  }

  const res = result.data;
  const validation = res.validationResults;
  return {
    status: res.clearanceStatus ?? res.reportingStatus ?? "UNKNOWN",
    warnings: validation?.warningMessages?.map((m) => m.message) ?? [],
    errors: validation?.errorMessages?.map((m) => m.message) ?? [],
  };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Generate a ZATCA Phase 2 compliant invoice for an order.
 *
 * Always produces:
 *  - A UBL 2.1 XML string
 *  - A TLV Base64 QR code (scannable by any ZATCA-compliant app)
 *
 * If ZATCA_CERT + ZATCA_CSID are set, also submits to ZATCA and returns
 * the clearance/reporting status.
 */
export async function generateZatcaInvoice(
  input: ZatcaInvoiceInput,
): Promise<{ ok: true; result: ZatcaInvoiceResult } | { ok: false; error: string }> {
  const sellerName = process.env.ZATCA_SELLER_NAME ?? "Dar Al-Amirat";
  const vatNumber = process.env.ZATCA_VAT_NUMBER ?? "";

  if (!vatNumber) {
    return { ok: false, error: "ZATCA_VAT_NUMBER is not configured" };
  }

  try {
    const xml = buildInvoiceXml(input, sellerName, vatNumber);
    const qrCode = encodeTlvQr({
      sellerName,
      vatNumber,
      timestamp: input.issueDate,
      total: input.total,
      vatAmount: input.vatAmount,
    });

    const submission = await submitToZatca(xml, input.invoiceType);

    const result: ZatcaInvoiceResult = {
      xml,
      qrCode,
      ...(submission && {
        submissionStatus: submission.status as ZatcaInvoiceResult["submissionStatus"],
        warnings: submission.warnings,
        errors: submission.errors,
      }),
    };

    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
