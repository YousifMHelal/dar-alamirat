/**
 * WhatsApp Cloud API client.
 *
 * Auth:
 *   Bearer token from Meta's Graph API. The token is a System User access
 *   token scoped to whatsapp_business_messaging. It never expires if the
 *   system user has the right permissions; otherwise a short-lived token
 *   or rotating token flow is used.
 *
 * Env vars:
 *   WHATSAPP_TOKEN        – Graph API bearer token (System User access token)
 *   WHATSAPP_PHONE_ID     – Phone number ID from WhatsApp Business Manager
 *   WHATSAPP_BASE_URL     – Defaults to https://graph.facebook.com/v20.0
 *
 * Template: order_status_update
 *   The template must be approved in the WhatsApp Business Manager before
 *   sending. Below is the expected payload shape based on standard Meta
 *   template structure:
 *
 *   Header: "Your order {{1}} has been updated."
 *   Body:   "Hi {{1}}, your order {{2}} is now {{3}}. {{4}}"
 *   Footer: "Dar Al-Amirat"
 *
 *   Parameters:
 *     header[0]  – order number
 *     body[0]    – customer name
 *     body[1]    – order number
 *     body[2]    – new status (human-readable)
 *     body[3]    – optional detail (e.g. waybill number, ETA)
 *
 * Sandbox / testing:
 *   Meta provides a test phone number in the WhatsApp Business API dashboard.
 *   Set WHATSAPP_TEST_NUMBER to override the recipient (useful in staging).
 *   When WHATSAPP_TEST_NUMBER is set, all messages go to that number regardless
 *   of the actual customer phone.
 */

import { integrationFetch } from "./fetch";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface OrderStatusUpdateParams {
  to: string; // recipient phone in E.164, e.g. "+966501234567"
  customerName: string;
  orderNumber: string;
  /** Human-readable status label (e.g. "Shipped", "تم الشحن"). */
  statusLabel: string;
  /** Optional extra context: waybill #, ETA, etc. */
  detail?: string;
  /** BCP 47 locale to select the template language variant. */
  locale?: "ar" | "en";
}

export interface WhatsAppSendResult {
  messageId: string;
  status: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const baseUrl = process.env.WHATSAPP_BASE_URL ?? "https://graph.facebook.com/v20.0";
  return { token, phoneId, baseUrl };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Send the `order_status_update` template to a customer when their order
 * status changes. Call from order status mutation server actions.
 *
 * If WHATSAPP_TOKEN or WHATSAPP_PHONE_ID are not set, the call is a no-op
 * and returns ok: false with a descriptive message (not an exception).
 */
export async function sendOrderStatusUpdate(
  params: OrderStatusUpdateParams,
): Promise<{ ok: true; result: WhatsAppSendResult } | { ok: false; error: string }> {
  const { token, phoneId, baseUrl } = getConfig();

  if (!token || !phoneId) {
    return {
      ok: false,
      error: "WhatsApp not configured: set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID",
    };
  }

  // In test/sandbox mode, send to the override number.
  const recipientPhone = process.env.WHATSAPP_TEST_NUMBER ?? params.to;

  // Normalise phone: WhatsApp expects no leading +, pure digits.
  const normalised = recipientPhone.replace(/^\+/, "").replace(/\s/g, "");

  const languageCode = params.locale === "ar" ? "ar" : "en_US";
  const detail = params.detail ?? "—";

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalised,
    type: "template",
    template: {
      name: "order_status_update",
      language: { code: languageCode },
      components: [
        {
          type: "header",
          parameters: [{ type: "text", text: params.orderNumber }],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: params.customerName },
            { type: "text", text: params.orderNumber },
            { type: "text", text: params.statusLabel },
            { type: "text", text: detail },
          ],
        },
      ],
    },
  };

  interface MetaSendResponse {
    messages?: Array<{ id: string; message_status?: string }>;
    error?: { message: string; type: string; code: number };
  }

  const result = await integrationFetch<MetaSendResponse>(
    `${baseUrl}/${phoneId}/messages`,
    {
      provider: "WhatsApp",
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    },
  );

  if (!result.ok) {
    return { ok: false, error: result.error.message };
  }

  if (result.data.error) {
    return { ok: false, error: result.data.error.message };
  }

  const msg = result.data.messages?.[0];
  if (!msg) {
    return { ok: false, error: "No message returned by WhatsApp API" };
  }

  return {
    ok: true,
    result: {
      messageId: msg.id,
      status: msg.message_status ?? "sent",
    },
  };
}

/**
 * Send a free-form text message (non-template). Only works within the 24-hour
 * customer-initiated conversation window; outside that window WhatsApp requires
 * an approved template. Used for cart recovery replies where a human is
 * responding to a recently active customer.
 */
export async function sendWhatsAppText(params: {
  to: string;
  text: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const { token, phoneId, baseUrl } = getConfig();

  if (!token || !phoneId) {
    return {
      ok: false,
      error: "WhatsApp not configured: set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID",
    };
  }

  const recipient = process.env.WHATSAPP_TEST_NUMBER ?? params.to;
  const normalised = recipient.replace(/^\+/, "").replace(/\s/g, "");

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalised,
    type: "text",
    text: { preview_url: false, body: params.text },
  };

  interface MetaSendResponse {
    messages?: Array<{ id: string }>;
    error?: { message: string };
  }

  const result = await integrationFetch<MetaSendResponse>(
    `${baseUrl}/${phoneId}/messages`,
    {
      provider: "WhatsApp",
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    },
  );

  if (!result.ok) return { ok: false, error: result.error.message };
  if (result.data.error) return { ok: false, error: result.data.error.message };

  const msg = result.data.messages?.[0];
  if (!msg) return { ok: false, error: "No message ID returned" };

  return { ok: true, messageId: msg.id };
}

/**
 * Status label lookup — maps DB enum to a human-readable label per locale.
 * Extend as templates are localised.
 */
export const ORDER_STATUS_LABELS: Record<
  string,
  { en: string; ar: string }
> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار" },
  CONFIRMED: { en: "Confirmed", ar: "تم التأكيد" },
  PROCESSING: { en: "Processing", ar: "قيد المعالجة" },
  SHIPPED: { en: "Shipped", ar: "تم الشحن" },
  DELIVERED: { en: "Delivered", ar: "تم التسليم" },
  CANCELLED: { en: "Cancelled", ar: "ملغي" },
};
