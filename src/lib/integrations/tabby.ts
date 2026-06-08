/**
 * Tabby reconciliation client.
 *
 * Auth:
 *   Secret key sent as a Bearer token in every request header.
 *   Tabby provides both a public key (frontend checkout) and a secret key
 *   (server-side settlement/reconciliation). We only use the secret key here.
 *
 * Env vars:
 *   TABBY_BASE_URL    – Sandbox: https://api.tabby.ai/api/v2
 *                       Production: https://api.tabby.ai/api/v2  (same host)
 *   TABBY_SECRET_KEY  – sk_test_... for sandbox, sk_live_... for production
 *
 * The settlements API returns a paginated list of settlement records.
 * Each settlement contains the payment ID, merchant order ID, amounts, and fees.
 *
 * Reference: Tabby Merchant API v2 docs
 *   https://docs.tabby.ai/
 */

import { integrationFetch } from "./fetch";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TabbySettlement {
  id: string;
  /** Tabby's payment ID — matches the external reference on our Payment row. */
  paymentId: string;
  /** Merchant's order reference as sent during checkout session creation. */
  merchantOrderId: string;
  settledAt: string; // ISO 8601
  /** Gross amount Tabby collected from the buyer. */
  grossAmount: number;
  /** Tabby's fee (to be flagged as gatewayFee). */
  fee: number;
  /** Net amount remitted to the merchant (grossAmount - fee). */
  netAmount: number;
  currency: string;
  status: "settled" | "refunded" | "partial_refund";
}

export interface TabbySettlementsPage {
  items: TabbySettlement[];
  hasMore: boolean;
  nextCursor?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getConfig() {
  return {
    baseUrl: process.env.TABBY_BASE_URL ?? "https://api.tabby.ai/api/v2",
    secretKey: process.env.TABBY_SECRET_KEY ?? "",
  };
}

interface TabbyApiSettlement {
  id: string;
  payment_id: string;
  order_id: string;
  created_at: string;
  amount: { value: number; currency: string };
  fee: { value: number; currency: string };
  net_amount: { value: number; currency: string };
  status: string;
}

interface TabbySettlementsResponse {
  data: TabbyApiSettlement[];
  paging?: { cursors?: { after?: string }; has_more?: boolean };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Fetch a page of settlements from Tabby.
 *
 * @param after  Cursor from a previous page (pagination).
 * @param limit  Number of records per page (max 100).
 */
export async function fetchTabbySettlements(
  after?: string,
  limit = 50,
): Promise<{ ok: true; page: TabbySettlementsPage } | { ok: false; error: string }> {
  const cfg = getConfig();

  if (!cfg.secretKey) {
    return { ok: false, error: "Tabby not configured: set TABBY_SECRET_KEY" };
  }

  const params = new URLSearchParams({ limit: String(limit) });
  if (after) params.set("after", after);

  const result = await integrationFetch<TabbySettlementsResponse>(
    `${cfg.baseUrl}/payments/settlements?${params.toString()}`,
    {
      provider: "Tabby",
      method: "GET",
      headers: { Authorization: `Bearer ${cfg.secretKey}` },
    },
  );

  if (!result.ok) return { ok: false, error: result.error.message };

  const items: TabbySettlement[] = result.data.data.map((s) => ({
    id: s.id,
    paymentId: s.payment_id,
    merchantOrderId: s.order_id,
    settledAt: s.created_at,
    grossAmount: s.amount.value,
    fee: s.fee.value,
    netAmount: s.net_amount.value,
    currency: s.amount.currency,
    status: s.status as TabbySettlement["status"],
  }));

  return {
    ok: true,
    page: {
      items,
      hasMore: result.data.paging?.has_more ?? false,
      nextCursor: result.data.paging?.cursors?.after,
    },
  };
}

/**
 * Fetch ALL settlements since a given date by auto-paginating.
 * Use this for the nightly reconciliation job.
 */
export async function fetchAllTabbySettlements(
  limit = 100,
): Promise<{ ok: true; settlements: TabbySettlement[] } | { ok: false; error: string }> {
  const all: TabbySettlement[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 20; page++) {
    const res = await fetchTabbySettlements(cursor, limit);
    if (!res.ok) return res;
    all.push(...res.page.items);
    if (!res.page.hasMore || !res.page.nextCursor) break;
    cursor = res.page.nextCursor;
  }

  return { ok: true, settlements: all };
}
