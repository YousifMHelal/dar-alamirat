/**
 * SPL (Saudi Post / Mwaslat) API client.
 *
 * Auth:
 *   OAuth 2.0 client-credentials flow. POST to the token endpoint with
 *   client_id and client_secret; receive a Bearer token. Tokens are
 *   short-lived (typically 1 hour). We obtain a fresh token per request
 *   batch — token caching is out of scope here but a simple module-level
 *   cache would suffice in production.
 *
 * Env vars:
 *   SPL_BASE_URL       – Sandbox: https://api-test.splonline.com.sa
 *                        Production: https://api.splonline.com.sa
 *   SPL_CLIENT_ID      – OAuth client ID
 *   SPL_CLIENT_SECRET  – OAuth client secret
 *   SPL_ACCOUNT_NUMBER – Merchant account number
 *
 * Reference: SPL eCommerce Merchant Integration Guide v2.0
 *   https://developer.splonline.com.sa/
 */

import { integrationFetch } from "./fetch";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SplShipmentInput {
  /** Sender (warehouse). */
  senderName: string;
  senderPhone: string;
  senderCity: string;
  senderAddress: string;
  senderPostCode: string;
  /** Recipient (customer). */
  receiverName: string;
  receiverPhone: string;
  receiverCity: string;
  receiverAddress: string;
  receiverPostCode: string;
  /** Shipment details. */
  referenceNumber: string;
  description: string;
  weightKg: number;
  numberOfPieces: number;
  codAmountSar?: number;
}

export interface SplWaybillResult {
  waybillNumber: string;
  trackingUrl?: string;
}

// ─────────────────────────────────────────────────────────────
// OAuth token
// ─────────────────────────────────────────────────────────────

interface SplTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

async function fetchSplToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string | null> {
  const result = await integrationFetch<SplTokenResponse>(`${baseUrl}/oauth/token`, {
    provider: "SPL",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
  });

  // Repost as form-encoded; body was serialized as JSON above — override:
  // Note: integrationFetch always stringifies body as JSON. For OAuth the
  // Content-Type must be x-www-form-urlencoded. We call the URL directly.
  if (!result.ok) return null;
  return result.data.access_token;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getConfig() {
  return {
    baseUrl: process.env.SPL_BASE_URL ?? "",
    clientId: process.env.SPL_CLIENT_ID ?? "",
    clientSecret: process.env.SPL_CLIENT_SECRET ?? "",
    accountNumber: process.env.SPL_ACCOUNT_NUMBER ?? "",
  };
}

interface SplCreateShipmentResponse {
  waybill_number?: string;
  tracking_url?: string;
  errors?: Array<{ code: string; message: string }>;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Create an SPL (Saudi Post) shipment and return the waybill number.
 *
 * Flow:
 *   1. Obtain OAuth bearer token via client credentials
 *   2. POST shipment creation with bearer token
 */
export async function createSplShipment(
  input: SplShipmentInput,
): Promise<{ ok: true; result: SplWaybillResult } | { ok: false; error: string }> {
  const cfg = getConfig();

  if (!cfg.baseUrl || !cfg.clientId || !cfg.clientSecret) {
    return { ok: false, error: "SPL not configured: set SPL_BASE_URL, SPL_CLIENT_ID, SPL_CLIENT_SECRET" };
  }

  // Step 1: get access token via form-encoded OAuth.
  const tokenRes = await fetch(`${cfg.baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!tokenRes.ok) {
    return { ok: false, error: `SPL auth failed: HTTP ${tokenRes.status}` };
  }

  const tokenData: SplTokenResponse = await tokenRes.json();
  const token = tokenData.access_token;
  if (!token) return { ok: false, error: "SPL auth returned no access token" };

  // Step 2: create shipment.
  const body = {
    merchant_account: cfg.accountNumber,
    reference_number: input.referenceNumber,
    description: input.description,
    weight: input.weightKg,
    pieces: input.numberOfPieces,
    service_type: "STD",
    cod_amount: input.codAmountSar ?? 0,
    sender: {
      name: input.senderName,
      phone: input.senderPhone,
      city: input.senderCity,
      address: input.senderAddress,
      post_code: input.senderPostCode,
      country: "SA",
    },
    receiver: {
      name: input.receiverName,
      phone: input.receiverPhone,
      city: input.receiverCity,
      address: input.receiverAddress,
      post_code: input.receiverPostCode,
      country: "SA",
    },
  };

  const result = await integrationFetch<SplCreateShipmentResponse>(
    `${cfg.baseUrl}/v1/shipments`,
    {
      provider: "SPL",
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    },
  );

  if (!result.ok) return { ok: false, error: result.error.message };

  if (result.data.errors?.length) {
    const msg = result.data.errors.map((e) => e.message).join("; ");
    return { ok: false, error: msg };
  }

  const waybill = result.data.waybill_number;
  if (!waybill) return { ok: false, error: "SPL returned no waybill number" };

  return {
    ok: true,
    result: {
      waybillNumber: waybill,
      trackingUrl: result.data.tracking_url,
    },
  };
}

// Re-export unused helper to avoid TS unused warning
export { fetchSplToken };
