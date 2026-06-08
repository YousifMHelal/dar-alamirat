/**
 * SMSA Express API client.
 *
 * Auth:
 *   Passkey sent as a query parameter on every request. SMSA provides a
 *   sandbox passkey for testing.
 *
 * Env vars:
 *   SMSA_BASE_URL  – Sandbox: https://www.smsaexpress.com/SmsaExpressService.asmx
 *                    (SMSA also exposes a REST JSON sandbox at their developer portal)
 *                    REST sandbox: https://saudipost.com/api/v1 (subject to change)
 *   SMSA_PASSKEY   – Provided by SMSA Express during onboarding
 *   SMSA_ACCOUNT_NUMBER – Merchant account number
 *
 * SMSA sandbox passkey (public, limited usage): "Testing1"
 * Note: SMSA's production endpoint differs from their sandbox; only the
 *       base URL changes.
 *
 * Reference: SMSA Express eCommerce Shipping API v2
 */

import { integrationFetch } from "./fetch";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SmsaShipmentInput {
  /** Sender (warehouse). */
  senderName: string;
  senderPhone: string;
  senderCity: string;
  senderAddress: string;
  /** Recipient (customer). */
  receiverName: string;
  receiverPhone: string;
  receiverCity: string;
  receiverAddress: string;
  /** Shipment details. */
  referenceNumber: string; // order number, stored as our ref
  description: string;
  weightKg: number;
  numberOfPieces: number;
  codAmountSar?: number;
}

export interface SmsaWaybillResult {
  waybillNumber: string;
  /** PDF label URL, if returned. */
  labelUrl?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getConfig() {
  return {
    baseUrl: process.env.SMSA_BASE_URL ?? "",
    passkey: process.env.SMSA_PASSKEY ?? "Testing1",
    accountNumber: process.env.SMSA_ACCOUNT_NUMBER ?? "",
  };
}

interface SmsaCreateShipmentResponse {
  // SMSA REST response shape
  awbNo?: string;
  labelUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Create an SMSA shipment and return the AWB (waybill) number.
 */
export async function createSmsaShipment(
  input: SmsaShipmentInput,
): Promise<{ ok: true; result: SmsaWaybillResult } | { ok: false; error: string }> {
  const cfg = getConfig();

  if (!cfg.baseUrl) {
    return { ok: false, error: "SMSA not configured: set SMSA_BASE_URL and SMSA_PASSKEY" };
  }

  const body = {
    passKey: cfg.passkey,
    shipperAccount: cfg.accountNumber,
    shipperName: input.senderName,
    shipperPhone: input.senderPhone,
    shipperCity: input.senderCity,
    shipperAddress: input.senderAddress,
    consigneeName: input.receiverName,
    consigneePhone: input.receiverPhone,
    consigneeCity: input.receiverCity,
    consigneeAddress: input.receiverAddress,
    referenceNo: input.referenceNumber,
    description: input.description,
    weight: input.weightKg.toString(),
    pieceNumber: input.numberOfPieces,
    codAmount: input.codAmountSar?.toFixed(2) ?? "0.00",
    codCurrency: "SAR",
    serviceType: "SLD", // Standard Land Delivery
  };

  const result = await integrationFetch<SmsaCreateShipmentResponse>(
    `${cfg.baseUrl}/createShipment`,
    { provider: "SMSA", method: "POST", body },
  );

  if (!result.ok) return { ok: false, error: result.error.message };

  if (result.data.errorCode) {
    return {
      ok: false,
      error: `SMSA error ${result.data.errorCode}: ${result.data.errorMessage ?? "unknown"}`,
    };
  }

  const awb = result.data.awbNo;
  if (!awb) return { ok: false, error: "SMSA returned no AWB number" };

  return {
    ok: true,
    result: { waybillNumber: awb, labelUrl: result.data.labelUrl },
  };
}
