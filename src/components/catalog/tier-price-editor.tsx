"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Loader2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { setTierPrices } from "@/lib/catalog/actions";

/**
 * B2B tier-price editor for a single product. Each row binds a pricing tier
 * to a wholesale price + MOQ. Saving replaces the full set for the product
 * (rows removed here are deleted server-side), so this editor is the single
 * source of truth for the product's wholesale pricing.
 */

interface Row {
  id?: string;
  pricingTierId: string;
  wholesalePrice: string;
  moq: string;
}

const ERROR_KEYS = ["tierRequired", "priceInvalid", "moqMin", "duplicateTier", "unknown"] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

export function TierPriceEditor({
  productId,
  tiers,
  initial,
}: {
  productId: string;
  tiers: Array<{ id: string; name: string }>;
  initial: Array<{ id: string; pricingTierId: string; wholesalePrice: string; moq: number }>;
}) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    initial.map((tp) => ({
      id: tp.id,
      pricingTierId: tp.pricingTierId,
      wholesalePrice: tp.wholesalePrice,
      moq: String(tp.moq),
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSave] = useTransition();

  const setRow = (idx: number, k: keyof Row, v: string) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [k]: v } : r)));

  const addRow = () =>
    setRows((prev) => [...prev, { pricingTierId: "", wholesalePrice: "", moq: "1" }]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const onSave = () => {
    setError(null);
    setSaved(false);
    startSave(async () => {
      const res = await setTierPrices({
        productId,
        tierPrices: rows.map((r) => ({
          id: r.id,
          pricingTierId: r.pricingTierId,
          wholesalePrice: r.wholesalePrice,
          moq: Number(r.moq) || 0,
        })),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        const key: ErrorKey = (ERROR_KEYS as readonly string[]).includes(res.error)
          ? (res.error as ErrorKey)
          : "unknown";
        setError(t(`form.errors.${key}` as const));
      }
    });
  };

  // Tiers already used in another row can't be reselected (one row per tier).
  const usedTierIds = new Set(rows.map((r) => r.pricingTierId).filter(Boolean));

  const selectClass =
    "border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-6 text-center text-sm">
          {t("form.noTierPrices")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r, idx) => (
            <div
              key={r.id ?? `new-${idx}`}
              className="border-border bg-surface-muted/40 grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
            >
              <div>
                <Label htmlFor={`tier-${idx}`}>{t("form.tierLabel")}</Label>
                <select
                  id={`tier-${idx}`}
                  value={r.pricingTierId}
                  onChange={(e) => setRow(idx, "pricingTierId", e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t("form.selectTier")}</option>
                  {tiers.map((tier) => (
                    <option
                      key={tier.id}
                      value={tier.id}
                      disabled={usedTierIds.has(tier.id) && r.pricingTierId !== tier.id}
                    >
                      {tier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`wp-${idx}`}>{t("form.wholesalePrice")}</Label>
                <Input
                  id={`wp-${idx}`}
                  type="text"
                  inputMode="decimal"
                  value={r.wholesalePrice}
                  onChange={(e) => setRow(idx, "wholesalePrice", e.target.value)}
                  dir="ltr"
                  className="text-end tabular-nums"
                />
              </div>
              <div className="sm:w-24">
                <Label htmlFor={`moq-${idx}`}>{t("form.moq")}</Label>
                <Input
                  id={`moq-${idx}`}
                  type="number"
                  min={1}
                  value={r.moq}
                  onChange={(e) => setRow(idx, "moq", e.target.value)}
                  dir="ltr"
                  className="text-end tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                aria-label={t("form.removeTierPrice")}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 mb-0.5 flex size-10 items-center justify-center rounded-lg transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-sm">
          <AlertTriangle className="size-4" />
          {error}
        </p>
      )}
      {saved && (
        <p className="text-success inline-flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="size-4" />
          {t("form.pricingSaved")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={addRow} disabled={rows.length >= tiers.length}>
          <Plus />
          {t("form.addTierPrice")}
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          {t("form.savePricing")}
        </Button>
      </div>
    </div>
  );
}
