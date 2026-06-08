/**
 * Aramex Shipping API client.
 *
 * Auth:
 *   Username/password credentials (AccountNumber, Pin, Entity, UserName,
 *   Password) sent in every request body under the ClientInfo object.
 *   No separate auth step required.
 *
 * Env vars:
 *   ARAMEX_BASE_URL    – Sandbox: https://ws.dev.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/JSON
 *                        Production: https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/JSON
 *   ARAMEX_USERNAME    – Portal login
 *   ARAMEX_PASSWORD    – Portal password
 *   ARAMEX_ACCOUNT_NUMBER
 *   ARAMEX_ACCOUNT_PIN
 *   ARAMEX_ACCOUNT_ENTITY – Usually "AMM" (Amman) for KSA shipments
 *   ARAMEX_ACCOUNT_COUNTRY_CODE – e.g. "SA"
 *
 * Sandbox credentials (public test account):
 *   Username: testingAPI@aramex.com
 *   Password: R123456789$r
 *   AccountNumber: 20016
 *   AccountPin: 0000
 *   AccountEntity: AMM
 *   AccountCountryCode: JO
 *   (KSA-specific sandbox credentials are issued per merchant by Aramex.)
 *
 * Reference: Aramex Shipping API v2 docs
 *   https://www.aramex.com/docs/developer/
 */

import { integrationFetch } from "./fetch";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AramexShipmentInput {
  /** Sender (warehouse) details. */
  originName: string;
  originPhone: string;
  originCity: string;
  originCountryCode: string; // e.g. "SA"
  originPostCode: string;
  originLine1: string;
  /** Recipient (customer) details. */
  destName: string;
  destPhone: string;
  destCity: string;
  destCountryCode: string;
  destPostCode: string;
  destLine1: string;
  /** Shipment details. */
  referenceNumber: string; // order number
  description: string;
  weightKg: number;
  /** Number of pieces in the shipment. */
  numberOfPieces: number;
  codAmountSar?: number; // if cash-on-delivery
}

export interface AramexWaybillResult {
  waybillNumber: string;
  labelUrl?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getConfig() {
  return {
    baseUrl: process.env.ARAMEX_BASE_URL ?? "",
    username: process.env.ARAMEX_USERNAME ?? "",
    password: process.env.ARAMEX_PASSWORD ?? "",
    accountNumber: process.env.ARAMEX_ACCOUNT_NUMBER ?? "",
    accountPin: process.env.ARAMEX_ACCOUNT_PIN ?? "",
    accountEntity: process.env.ARAMEX_ACCOUNT_ENTITY ?? "",
    countryCode: process.env.ARAMEX_ACCOUNT_COUNTRY_CODE ?? "",
  };
}

function buildClientInfo(cfg: ReturnType<typeof getConfig>) {
  return {
    UserName: cfg.username,
    Password: cfg.password,
    Version: "v1.0",
    AccountNumber: cfg.accountNumber,
    AccountPin: cfg.accountPin,
    AccountEntity: cfg.accountEntity,
    AccountCountryCode: cfg.countryCode,
    Source: 24,
  };
}

interface AramexCreateShipmentResponse {
  HasErrors: boolean;
  Shipments?: Array<{
    ID: string;
    ShippingLabelURL?: string;
  }>;
  Notifications?: Array<{ Code: string; Message: string }>;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Create an Aramex shipment and return the waybill number.
 * Waybill is then stored on the Shipment record in the DB.
 */
export async function createAramexShipment(
  input: AramexShipmentInput,
): Promise<{ ok: true; result: AramexWaybillResult } | { ok: false; error: string }> {
  const cfg = getConfig();

  if (!cfg.baseUrl || !cfg.username || !cfg.accountNumber) {
    return { ok: false, error: "Aramex not configured: check ARAMEX_* env vars" };
  }

  const body = {
    ClientInfo: buildClientInfo(cfg),
    LabelInfo: { ReportID: 9201, ReportType: "URL" },
    Shipments: [
      {
        Shipper: {
          Reference1: input.referenceNumber,
          AccountNumber: cfg.accountNumber,
          PartyAddress: {
            Line1: input.originLine1,
            City: input.originCity,
            CountryCode: input.originCountryCode,
            PostCode: input.originPostCode,
          },
          Contact: {
            PersonName: input.originName,
            PhoneNumber1: input.originPhone,
          },
        },
        Consignee: {
          Reference1: input.referenceNumber,
          PartyAddress: {
            Line1: input.destLine1,
            City: input.destCity,
            CountryCode: input.destCountryCode,
            PostCode: input.destPostCode,
          },
          Contact: {
            PersonName: input.destName,
            PhoneNumber1: input.destPhone,
          },
        },
        ShippingDateTime: `/Date(${Date.now()})/`,
        DueDate: `/Date(${Date.now() + 3 * 24 * 3600 * 1000})/`,
        Details: {
          Dimensions: { Length: 0, Width: 0, Height: 0, Unit: "CM" },
          ActualWeight: { Value: input.weightKg, Unit: "KG" },
          ProductType: "CDS",
          PayType: "P",
          Services: input.codAmountSar ? "COD" : "",
          NumberOfPieces: input.numberOfPieces,
          DescriptionOfGoods: input.description,
          GoodsOriginCountry: "SA",
          CashOnDeliveryAmount: input.codAmountSar
            ? { Value: input.codAmountSar, CurrencyCode: "SAR" }
            : undefined,
        },
      },
    ],
  };

  const result = await integrationFetch<AramexCreateShipmentResponse>(
    `${cfg.baseUrl}/CreateShipments`,
    { provider: "Aramex", method: "POST", body },
  );

  if (!result.ok) return { ok: false, error: result.error.message };

  if (result.data.HasErrors) {
    const msgs = result.data.Notifications?.map((n) => n.Message).join("; ") ?? "Unknown error";
    return { ok: false, error: msgs };
  }

  const shipment = result.data.Shipments?.[0];
  if (!shipment?.ID) return { ok: false, error: "Aramex returned no shipment ID" };

  return {
    ok: true,
    result: {
      waybillNumber: shipment.ID,
      labelUrl: shipment.ShippingLabelURL,
    },
  };
}
