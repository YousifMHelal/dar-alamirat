import { prisma } from "@/lib/prisma";

/**
 * Integration settings live as JSON rows in the Setting table (key →
 * placeholder config), seeded with `enabled: false` and blank credentials —
 * real keys are wired in a later phase. This module just reads them back
 * as typed, grouped data for the Settings page.
 */

export type IntegrationGroup = "messaging" | "tax" | "payments" | "shipping";

export type IntegrationKey =
  | "meta_whatsapp"
  | "zatca"
  | "tabby"
  | "tamara"
  | "mada"
  | "aramex"
  | "smsa"
  | "spl";

export interface IntegrationSetting {
  key: IntegrationKey;
  group: IntegrationGroup;
  enabled: boolean;
  hasApiKey: boolean;
  hasSecret: boolean;
  note: string | null;
  updatedAt: Date;
}

const INTEGRATION_GROUPS: Record<IntegrationKey, IntegrationGroup> = {
  meta_whatsapp: "messaging",
  zatca: "tax",
  tabby: "payments",
  tamara: "payments",
  mada: "payments",
  aramex: "shipping",
  smsa: "shipping",
  spl: "shipping",
};

interface PlaceholderIntegrationValue {
  enabled?: boolean;
  apiKey?: string;
  secret?: string;
  note?: string;
}

export async function listIntegrationSettings(): Promise<IntegrationSetting[]> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.keys(INTEGRATION_GROUPS) } },
    select: { key: true, valueJson: true, updatedAt: true },
  });

  return rows
    .filter((row): row is typeof row & { key: IntegrationKey } => row.key in INTEGRATION_GROUPS)
    .map((row) => {
      const value = (row.valueJson ?? {}) as PlaceholderIntegrationValue;
      return {
        key: row.key,
        group: INTEGRATION_GROUPS[row.key],
        enabled: value.enabled ?? false,
        hasApiKey: Boolean(value.apiKey?.trim()),
        hasSecret: Boolean(value.secret?.trim()),
        note: value.note ?? null,
        updatedAt: row.updatedAt,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
