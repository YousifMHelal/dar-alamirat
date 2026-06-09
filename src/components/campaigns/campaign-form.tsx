"use client";

import { useState, useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Plus, Trash2, Megaphone, Package, Eye, Percent, DollarSign, Search, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createCampaign, updateCampaign, deleteCampaign } from "@/lib/campaigns/actions";
import { searchVariants } from "@/lib/orders/actions";
import type { CampaignDetail } from "@/lib/campaigns/queries";
import { formatSar } from "@/lib/format";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BundleItemDraft {
  _key: string;
  id?: string;
  productVariantId: string;
  quantity: number;
  variantLabel: string;
}

interface BundleDraft {
  _key: string;
  id?: string;
  nameEn: string;
  nameAr: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  minOrderAmount: string;
  items: BundleItemDraft[];
}

interface VariantSearchResult {
  variantId: string;
  sku: string;
  label: string;
  colorName: string | null;
  price: string;
}

let _keyCounter = 0;
const nextKey = () => String(++_keyCounter);

function draftFromDetail(detail: CampaignDetail): {
  nameEn: string;
  nameAr: string;
  occasion: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  bundles: BundleDraft[];
} {
  return {
    nameEn: detail.nameEn,
    nameAr: detail.nameAr,
    occasion: detail.occasion,
    startsAt: detail.startsAt,
    endsAt: detail.endsAt,
    isActive: detail.isActive,
    bundles: detail.bundles.map((b) => ({
      _key: nextKey(),
      id: b.id,
      nameEn: b.nameEn,
      nameAr: b.nameAr,
      discountType: b.discountType,
      discountValue: b.discountValue,
      minOrderAmount: b.minOrderAmount,
      items: b.items.map((item) => ({
        _key: nextKey(),
        id: item.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        variantLabel: item.variantLabel,
      })),
    })),
  };
}

// ─── Main form component ─────────────────────────────────────────────────────

export function CampaignForm({
  locale,
  detail,
}: {
  locale: string;
  detail?: CampaignDetail;
}) {
  const t = useTranslations("campaigns");
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!detail;

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activePreviewBundle, setActivePreviewBundle] = useState<number | null>(null);

  const initial = detail
    ? draftFromDetail(detail)
    : {
        nameEn: "",
        nameAr: "",
        occasion: "",
        startsAt: "",
        endsAt: "",
        isActive: true,
        bundles: [] as BundleDraft[],
      };

  const [nameEn, setNameEn] = useState(initial.nameEn);
  const [nameAr, setNameAr] = useState(initial.nameAr);
  const [occasion, setOccasion] = useState(initial.occasion);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [bundles, setBundles] = useState<BundleDraft[]>(initial.bundles);

  function addBundle() {
    setBundles((prev) => [
      ...prev,
      {
        _key: nextKey(),
        nameEn: "",
        nameAr: "",
        discountType: "PERCENTAGE",
        discountValue: "",
        minOrderAmount: "",
        items: [],
      },
    ]);
  }

  function removeBundle(key: string) {
    setBundles((prev) => prev.filter((b) => b._key !== key));
    setActivePreviewBundle(null);
  }

  function updateBundle(key: string, patch: Partial<BundleDraft>) {
    setBundles((prev) =>
      prev.map((b) => (b._key === key ? { ...b, ...patch } : b)),
    );
  }

  function addBundleItem(bundleKey: string, item: Omit<BundleItemDraft, "_key">) {
    setBundles((prev) =>
      prev.map((b) =>
        b._key === bundleKey
          ? { ...b, items: [...b.items, { ...item, _key: nextKey() }] }
          : b,
      ),
    );
  }

  function removeBundleItem(bundleKey: string, itemKey: string) {
    setBundles((prev) =>
      prev.map((b) =>
        b._key === bundleKey
          ? { ...b, items: b.items.filter((i) => i._key !== itemKey) }
          : b,
      ),
    );
  }

  function updateBundleItemQty(bundleKey: string, itemKey: string, qty: number) {
    setBundles((prev) =>
      prev.map((b) =>
        b._key === bundleKey
          ? {
              ...b,
              items: b.items.map((i) =>
                i._key === itemKey ? { ...i, quantity: qty } : i,
              ),
            }
          : b,
      ),
    );
  }

  function buildPayload() {
    return {
      nameEn,
      nameAr,
      occasion,
      startsAt,
      endsAt,
      isActive,
      bundles: bundles.map((b) => ({
        id: b.id,
        nameEn: b.nameEn,
        nameAr: b.nameAr,
        discountType: b.discountType,
        discountValue: b.discountValue,
        minOrderAmount: b.minOrderAmount,
        items: b.items.map((item) => ({
          id: item.id,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
        })),
      })),
    };
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const payload = buildPayload();
      const result = isEdit
        ? await updateCampaign({ ...payload, id: detail!.id })
        : await createCampaign(payload);

      if (result.ok) {
        if (isEdit) {
          toast(t("form.saved"), "success");
        } else {
          router.push(`/campaigns/${result.campaignId}`);
        }
      } else {
        setError(t(`form.errors.${result.error}` as never) ?? result.error);
      }
    });
  }

  function handleDelete() {
    if (!detail) return;
    startTransition(async () => {
      const result = await deleteCampaign(detail.id);
      if (result.ok) {
        router.push("/campaigns");
      } else {
        setError(t(`form.errors.${result.error}` as never) ?? result.error);
        setConfirmDelete(false);
      }
    });
  }

  const previewIndex = activePreviewBundle !== null ? activePreviewBundle : bundles.length > 0 ? 0 : null;
  const previewBundle = previewIndex !== null ? bundles[previewIndex] : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Left — form */}
      <div className="flex flex-col gap-8">
        {/* Campaign details */}
        <section className="bg-card border-border shadow-soft rounded-2xl border p-6">
          <h2 className="font-display text-foreground mb-5 flex items-center gap-2 text-base font-semibold">
            <Megaphone className="text-primary size-4" />
            {t("form.sectionDetails")}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nameEn">{t("form.nameEn")}</Label>
              <Input
                id="nameEn"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="nameAr">{t("form.nameAr")}</Label>
              <Input
                id="nameAr"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                dir="rtl"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="occasion">{t("occasion.label")}</Label>
              <Input
                id="occasion"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder={t("occasion.placeholder")}
              />
            </div>
            <div>
              <Label htmlFor="startsAt">{t("form.startsAt")}</Label>
              <Input
                id="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endsAt">{t("form.endsAt")}</Label>
              <Input
                id="endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive((v) => !v)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                    isActive ? "ltr:translate-x-5 rtl:-translate-x-5" : "translate-x-0",
                  )}
                />
              </button>
              <div>
                <p className="text-foreground text-sm font-medium">{t("form.isActive")}</p>
                <p className="text-muted-foreground text-xs">{t("form.isActiveHint")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Bundles */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-foreground flex items-center gap-2 text-base font-semibold">
              <Package className="text-primary size-4" />
              {t("form.sectionBundles")}
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={addBundle}>
              <Plus className="size-4" />
              {t("form.addBundle")}
            </Button>
          </div>

          {bundles.length === 0 && (
            <p className="text-muted-foreground bg-muted rounded-xl px-4 py-8 text-center text-sm">
              {t("form.noBundles")}
            </p>
          )}

          {bundles.map((bundle, idx) => (
            <BundleEditor
              key={bundle._key}
              bundle={bundle}
              index={idx}
              locale={locale}
              onUpdate={(patch) => updateBundle(bundle._key, patch)}
              onRemove={() => removeBundle(bundle._key)}
              onAddItem={(item) => addBundleItem(bundle._key, item)}
              onRemoveItem={(itemKey) => removeBundleItem(bundle._key, itemKey)}
              onUpdateItemQty={(itemKey, qty) => updateBundleItemQty(bundle._key, itemKey, qty)}
              onPreview={() =>
                setActivePreviewBundle((prev) => (prev === idx ? null : idx))
              }
              isPreviewing={previewIndex === idx}
              t={t}
            />
          ))}
        </section>

        {error && (
          <FieldError>{error}</FieldError>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={isPending}>
            {isPending
              ? isEdit
                ? t("form.saving")
                : t("form.creating")
              : isEdit
                ? t("form.save")
                : t("form.create")}
          </Button>
          {isEdit && !confirmDelete && (
            <Button
              variant="outline"
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
            >
              {t("form.delete")}
            </Button>
          )}
          {isEdit && confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-destructive text-sm">{t("form.confirmDelete")}</span>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={isPending}>
                {t("form.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isPending ? t("form.deleting") : t("form.delete")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right — preview panel */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <h2 className="font-display text-foreground flex items-center gap-2 text-base font-semibold">
          <Eye className="text-primary size-4" />
          {t("preview.title")}
        </h2>
        <p className="text-muted-foreground text-xs">{t("preview.subtitle")}</p>

        {previewBundle ? (
          <BundlePreviewCard bundle={previewBundle} locale={locale} t={t} />
        ) : (
          <div className="bg-muted rounded-xl px-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">{t("preview.noBundle")}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

// ─── Bundle editor ────────────────────────────────────────────────────────────

function BundleEditor({
  bundle,
  index,
  locale,
  onUpdate,
  onRemove,
  onAddItem,
  onRemoveItem,
  onUpdateItemQty,
  onPreview,
  isPreviewing,
  t,
}: {
  bundle: BundleDraft;
  index: number;
  locale: string;
  onUpdate: (patch: Partial<BundleDraft>) => void;
  onRemove: () => void;
  onAddItem: (item: Omit<BundleItemDraft, "_key">) => void;
  onRemoveItem: (itemKey: string) => void;
  onUpdateItemQty: (itemKey: string, qty: number) => void;
  onPreview: () => void;
  isPreviewing: boolean;
  t: ReturnType<typeof useTranslations<"campaigns">>;
}) {
  return (
    <div className="bg-card border-border shadow-soft rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">
          {t("form.bundle", { n: index + 1 })}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPreview}
            className={cn(isPreviewing && "bg-primary/8 border-primary")}
          >
            <Eye className="size-3.5" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onRemove}>
            <Trash2 className="size-3.5 text-destructive" />
            {t("form.removeBundle")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{t("form.bundleNameEn")}</Label>
          <Input
            value={bundle.nameEn}
            onChange={(e) => onUpdate({ nameEn: e.target.value })}
            dir="ltr"
          />
        </div>
        <div>
          <Label>{t("form.bundleNameAr")}</Label>
          <Input
            value={bundle.nameAr}
            onChange={(e) => onUpdate({ nameAr: e.target.value })}
            dir="rtl"
          />
        </div>
        <div>
          <Label>{t("form.discountType")}</Label>
          <select
            value={bundle.discountType}
            onChange={(e) =>
              onUpdate({ discountType: e.target.value as "PERCENTAGE" | "FIXED" })
            }
            className="border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm"
          >
            <option value="PERCENTAGE">{t("form.discountTypePercentage")}</option>
            <option value="FIXED">{t("form.discountTypeFixed")}</option>
          </select>
        </div>
        <div>
          <Label>{t("form.discountValue")}</Label>
          <div className="relative">
            <div className="text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2">
              {bundle.discountType === "PERCENTAGE" ? (
                <Percent className="size-3.5" />
              ) : (
                <DollarSign className="size-3.5" />
              )}
            </div>
            <Input
              className="ps-8"
              value={bundle.discountValue}
              onChange={(e) => onUpdate({ discountValue: e.target.value })}
              placeholder="0"
              inputMode="decimal"
              dir="ltr"
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label>{t("form.minOrderAmount")}</Label>
          <Input
            value={bundle.minOrderAmount}
            onChange={(e) => onUpdate({ minOrderAmount: e.target.value })}
            placeholder="0"
            inputMode="decimal"
            dir="ltr"
          />
          <p className="text-muted-foreground mt-1 text-xs">{t("form.minOrderAmountHint")}</p>
        </div>
      </div>

      {/* Bundle items */}
      <div className="mt-5">
        <p className="text-foreground mb-2 text-xs font-semibold">{t("form.bundleItems")}</p>
        {bundle.items.length > 0 && (
          <div className="mb-3 flex flex-col gap-1.5">
            {bundle.items.map((item) => (
              <div
                key={item._key}
                className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2"
              >
                <span className="text-foreground flex-1 truncate text-xs">{item.variantLabel}</span>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => onUpdateItemQty(item._key, Number(e.target.value))}
                  className="border-input bg-surface text-foreground h-7 w-16 rounded border px-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => onRemoveItem(item._key)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <VariantSearch
          locale={locale}
          onSelect={(v) =>
            onAddItem({
              productVariantId: v.variantId,
              quantity: 1,
              variantLabel: v.label,
            })
          }
          t={t}
        />
      </div>
    </div>
  );
}

// ─── Variant search ───────────────────────────────────────────────────────────

function VariantSearch({
  locale,
  onSelect,
  t,
}: {
  locale: string;
  onSelect: (v: VariantSearchResult) => void;
  t: ReturnType<typeof useTranslations<"campaigns">>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const result = await searchVariants(q);
      if (result.ok) {
        setResults(
          result.items.map((item) => ({
            variantId: item.variantId,
            sku: item.sku,
            label: item.label,
            colorName: item.colorName,
            price: item.unitPrice,
          })),
        );
      }
    } finally {
      setSearching(false);
    }
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="text-muted-foreground absolute start-3 top-1/2 size-3.5 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          placeholder={t("form.searchVariants")}
          className="border-input bg-surface text-foreground placeholder:text-muted-foreground h-9 w-full rounded-lg border ps-8 pe-3 text-sm"
        />
      </div>
      {(results.length > 0 || searching) && (
        <div className="border-border bg-card shadow-soft absolute z-20 mt-1 w-full overflow-hidden rounded-xl border text-sm">
          {searching && (
            <p className="text-muted-foreground px-3 py-2 text-xs">Searching…</p>
          )}
          {results.map((v) => (
            <button
              key={v.variantId}
              type="button"
              onClick={() => {
                onSelect(v);
                setQuery("");
                setResults([]);
              }}
              className="hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-2 text-start"
            >
              <div>
                <p className="text-foreground text-xs font-medium">{v.label}</p>
                <p className="text-muted-foreground text-xs" dir="ltr">{v.sku}</p>
              </div>
              <span className="text-primary shrink-0 text-xs font-semibold">
                {formatSar(v.price, locale)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bundle preview card ──────────────────────────────────────────────────────

function BundlePreviewCard({
  bundle,
  locale,
  t,
}: {
  bundle: BundleDraft;
  locale: string;
  t: ReturnType<typeof useTranslations<"campaigns">>;
}) {
  const name = locale === "ar" ? bundle.nameAr : bundle.nameEn;
  const discountLabel =
    bundle.discountType === "PERCENTAGE"
      ? t("preview.discount", { value: bundle.discountValue || "0" })
      : t("preview.discountFixed", { value: bundle.discountValue || "0" });

  return (
    <div className="bg-card border-border overflow-hidden rounded-2xl border">
      {/* Banner gradient */}
      <div className="from-primary/20 to-primary/5 flex items-center justify-between bg-gradient-to-r px-5 py-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            {t("preview.title")}
          </p>
          <h3 className="text-foreground mt-0.5 font-semibold">
            {name || <span className="opacity-40">Bundle name</span>}
          </h3>
        </div>
        <Badge tone="success">{discountLabel}</Badge>
      </div>

      <div className="px-5 py-4">
        <p className="text-muted-foreground mb-3 text-xs">
          {t("preview.items", { count: bundle.items.length })}
        </p>
        {bundle.items.length === 0 ? (
          <p className="text-muted-foreground text-xs italic">No products added yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {bundle.items.map((item) => (
              <li key={item._key} className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary flex size-5 items-center justify-center rounded-full text-[10px] font-semibold">
                  {item.quantity}
                </span>
                <span className="text-foreground truncate text-xs">{item.variantLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
