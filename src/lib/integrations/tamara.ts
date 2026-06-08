/**
 * Tamara reconciliation client.
 *
 * Auth:
 *   Bearer token (Notification Token or Merchant API Token) issued by Tamara
 *   during onboarding. Sent in the Authorization header.
 *
 * Env vars:
 *   TAMARA_BASE_URL   – Sandbox: https://api-sandbox.tamara.co
 *                       Production: https://api.tamara.co
 *   TAMARA_API_TOKEN  – Merchant API token (Bearer)
 *   TAMARA_MERCHANT_ID – Tamara merchant identifier
 *
 * The Tamara API uses an "Orders" resource with a payment status. We poll
 * their orders endpoint to get settlement/payout information.
 *
 * Reference: Tamara Merchant Integration v1
 *   https://docs.tamara.co/
 */

import { integrationFetch } from "./fetch";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TamaraSettlement {
  id: string;
  /** Tamara order ID. */
  orderId: string;
  /** Merchant's order reference. */
  merchantOrderId: string;
  settledAt: string; // ISO 8601
  grossAmount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: "captured" | "refunded" | "partial_refund" | "authorised";
}

export interface TamaraSettlementsPage {
  items: TamaraSettlement[];
  totalCount: number;
  hasMore: boolean;
  nextPage: number;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getConfig() {
  return {
    baseUrl: process.env.TAMARA_BASE_URL ?? "https://api-sandbox.tamara.co",
    apiToken: process.env.TAMARA_API_TOKEN ?? "",
    merchantId: process.env.TAMARA_MERCHANT_ID ?? "",
  };
}

interface TamaraApiOrder {
  order_id: string;
  order_reference_id: string;
  status: string;
  total_amount: { amount: number; currency: string };
  payment_type: string;
  created_at: string;
  captured_at?: string;
  // Tamara's settlement report includes merchant fees per order.
  merchant_fee?: { amount: number; currency: string };
}

interface TamaraOrdersResponse {
  orders: TamaraApiOrder[];
  total_records: number;
  page: number;
  page_size: number;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Fetch a page of captured/settled Tamara orders for reconciliation.
 */
export async function fetchTamaraSettlements(
  page = 0,
  pageSize = 50,
): Promise<{ ok: true; page: TamaraSettlementsPage } | { ok: false; error: string }> {
  const cfg = getConfig();

  if (!cfg.apiToken) {
    return { ok: false, error: "Tamara not configured: set TAMARA_API_TOKEN" };
  }

  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    // Only fetch captured (settled) orders for reconciliation.
    status: "captured",
  });

  const result = await integrationFetch<TamaraOrdersResponse>(
    `${cfg.baseUrl}/merchants/${cfg.merchantId}/orders?${params.toString()}`,
    {
      provider: "Tamara",
      method: "GET",
      headers: { Authorization: `Bearer ${cfg.apiToken}` },
    },
  );

  if (!result.ok) return { ok: false, error: result.error.message };

  const data = result.data;
  const items: TamaraSettlement[] = data.orders.map((o) => {
    const fee = o.merchant_fee?.amount ?? 0;
    const gross = o.total_amount.amount;
    return {
      id: o.order_id,
      orderId: o.order_id,
      merchantOrderId: o.order_reference_id,
      settledAt: o.captured_at ?? o.created_at,
      grossAmount: gross,
      fee,
      netAmount: gross - fee,
      currency: o.total_amount.currency,
      status: o.status as TamaraSettlement["status"],
    };
  });

  const fetched = page * pageSize + items.length;
  return {
    ok: true,
    page: {
      items,
      totalCount: data.total_records,
      hasMore: fetched < data.total_records,
      nextPage: page + 1,
    },
  };
}

/**
 * Fetch ALL settled Tamara orders by auto-paginating.
 */
export async function fetchAllTamaraSettlements(
  pageSize = 100,
): Promise<{ ok: true; settlements: TamaraSettlement[] } | { ok: false; error: string }> {
  const all: TamaraSettlement[] = [];
  let page = 0;

  for (let i = 0; i < 20; i++) {
    const res = await fetchTamaraSettlements(page, pageSize);
    if (!res.ok) return res;
    all.push(...res.page.items);
    if (!res.page.hasMore) break;
    page = res.page.nextPage;
  }

  return { ok: true, settlements: all };
}
