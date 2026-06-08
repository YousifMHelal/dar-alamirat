"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  PackagePlus,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/catalog/actions";
import type { ProductDetail } from "@/lib/catalog/queries";
import { TierPriceEditor } from "./tier-price-editor";

/**
 * Create/edit form for a product and its variants. The same component
 * serves both modes — `product` present ⇒ edit, absent ⇒ create. Validation
 * mirrors lib/catalog/schema; the server re-validates authoritatively and
 * returns `{ ok }` error keys we translate. The B2B tier-price editor is a
 * sibling section that saves independently (only available once the product
 * exists, i.e. in edit mode).
 */

interface VariantRow {
  id?: string;
  colorName: string;
  colorHex: string;
  capacity: string;
  variantSku: string;
  barcode: string;
  priceOverride: string;
}

const emptyVariant = (): VariantRow => ({
  colorName: "",
  colorHex: "",
  capacity: "",
  variantSku: "",
  barcode: "",
  priceOverride: "",
});

// Known server error keys → catalog.form.errors.*
const ERROR_KEYS = [
  "nameArRequired",
  "nameEnRequired",
  "skuRequired",
  "skuTaken",
  "brandRequired",
  "priceInvalid",
  "categoryRequired",
  "variantRequired",
  "variantSkuRequired",
  "variantSkuTaken",
  "variantInUse",
  "productInUse",
  "hexInvalid",
  "notFound",
  "unknown",
] as const;

type ErrorKey = (typeof ERROR_KEYS)[number];

function translateError(t: ReturnType<typeof useTranslations<"catalog">>, error: string): string {
  const key: ErrorKey = (ERROR_KEYS as readonly string[]).includes(error)
    ? (error as ErrorKey)
    : "unknown";
  return t(`form.errors.${key}` as const);
}

export function ProductForm({
  locale,
  product,
  categories,
  tiers,
}: {
  locale: string;
  product?: ProductDetail;
  categories: Array<{ id: string; nameEn: string; nameAr: string }>;
  tiers: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const isEdit = Boolean(product);

  const [form, setForm] = useState({
    nameAr: product?.nameAr ?? "",
    nameEn: product?.nameEn ?? "",
    descriptionAr: product?.descriptionAr ?? "",
    descriptionEn: product?.descriptionEn ?? "",
    sku: product?.sku ?? "",
    brand: product?.brand ?? "",
    basePrice: product?.basePrice ?? "",
    active: product?.active ?? true,
    categoryId: product?.categoryId ?? "",
  });
  const [variants, setVariants] = useState<VariantRow[]>(
    product?.variants.map((v) => ({
      id: v.id,
      colorName: v.colorName ?? "",
      colorHex: v.colorHex ?? "",
      capacity: v.capacity ?? "",
      variantSku: v.variantSku,
      barcode: v.barcode ?? "",
      priceOverride: v.priceOverride ?? "",
    })) ?? [emptyVariant()],
  );

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setVariant = (idx: number, k: keyof VariantRow, v: string) =>
    setVariants((prev) => prev.map((row, i) => (i === idx ? { ...row, [k]: v } : row)));

  const addVariant = () => setVariants((prev) => [...prev, emptyVariant()]);
  const removeVariant = (idx: number) =>
    setVariants((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const onSave = () => {
    setError(null);
    setSaved(false);
    const payload = {
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      descriptionAr: form.descriptionAr,
      descriptionEn: form.descriptionEn,
      sku: form.sku,
      brand: form.brand,
      basePrice: form.basePrice,
      active: form.active,
      categoryId: form.categoryId,
      variants: variants.map((v) => ({
        id: v.id,
        colorName: v.colorName,
        colorHex: v.colorHex,
        capacity: v.capacity,
        variantSku: v.variantSku,
        barcode: v.barcode,
        priceOverride: v.priceOverride,
      })),
    };

    startSave(async () => {
      const res =
        isEdit && product
          ? await updateProduct({ ...payload, id: product.id })
          : await createProduct(payload);
      if (res.ok) {
        if (isEdit) {
          setSaved(true);
          router.refresh();
        } else {
          router.push(`/catalog/${res.productId}`);
        }
      } else {
        setError(translateError(t, res.error));
      }
    });
  };

  const onDelete = () => {
    if (!product) return;
    if (!window.confirm(t("form.confirmDelete"))) return;
    setError(null);
    startDelete(async () => {
      const res = await deleteProduct(product.id);
      if (res.ok) router.push("/catalog");
      else setError(translateError(t, res.error));
    });
  };

  const textareaClass =
    "border-input bg-surface text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm shadow-soft transition-colors focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Product details ─────────────────────────────────────────── */}
      <Section title={t("form.sectionDetails")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nameEn">{t("form.nameEn")}</Label>
            <Input id="nameEn" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label htmlFor="nameAr">{t("form.nameAr")}</Label>
            <Input id="nameAr" value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} dir="rtl" />
          </div>
          <div>
            <Label htmlFor="sku">{t("form.sku")}</Label>
            <Input id="sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label htmlFor="brand">{t("form.brand")}</Label>
            <Input id="brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="category">{t("form.category")}</Label>
            <select
              id="category"
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className="border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">{t("form.selectCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "ar" ? c.nameAr : c.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="basePrice">{t("form.basePrice")}</Label>
            <Input
              id="basePrice"
              type="text"
              inputMode="decimal"
              value={form.basePrice}
              onChange={(e) => set("basePrice", e.target.value)}
              dir="ltr"
              className="text-end tabular-nums"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="descEn">{t("form.descriptionEn")}</Label>
            <textarea
              id="descEn"
              rows={2}
              value={form.descriptionEn}
              onChange={(e) => set("descriptionEn", e.target.value)}
              dir="ltr"
              className={textareaClass}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="descAr">{t("form.descriptionAr")}</Label>
            <textarea
              id="descAr"
              rows={2}
              value={form.descriptionAr}
              onChange={(e) => set("descriptionAr", e.target.value)}
              dir="rtl"
              className={textareaClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set("active", e.target.checked)}
                className="border-input text-primary focus-visible:ring-ring/30 size-4 rounded border focus-visible:ring-2"
              />
              <span className="text-foreground text-sm font-medium">{t("form.active")}</span>
              <span className="text-muted-foreground text-xs">{t("form.activeHint")}</span>
            </label>
          </div>
        </div>
      </Section>

      {/* ── Variants ────────────────────────────────────────────────── */}
      <Section
        title={t("form.sectionVariants")}
        action={
          <Button variant="outline" size="sm" onClick={addVariant}>
            <Plus />
            {t("form.addVariant")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {variants.map((v, idx) => (
            <div key={v.id ?? `new-${idx}`} className="border-border bg-surface-muted/40 rounded-xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-foreground text-sm font-medium">{t("form.variant", { n: idx + 1 })}</span>
                <button
                  type="button"
                  onClick={() => removeVariant(idx)}
                  disabled={variants.length <= 1}
                  aria-label={t("form.removeVariant")}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label htmlFor={`vsku-${idx}`}>{t("form.variantSku")}</Label>
                  <Input
                    id={`vsku-${idx}`}
                    value={v.variantSku}
                    onChange={(e) => setVariant(idx, "variantSku", e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label htmlFor={`cap-${idx}`}>{t("form.capacity")}</Label>
                  <Input
                    id={`cap-${idx}`}
                    value={v.capacity}
                    onChange={(e) => setVariant(idx, "capacity", e.target.value)}
                    placeholder="50ml"
                  />
                </div>
                <div>
                  <Label htmlFor={`barcode-${idx}`}>{t("form.barcode")}</Label>
                  <Input
                    id={`barcode-${idx}`}
                    value={v.barcode}
                    onChange={(e) => setVariant(idx, "barcode", e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label htmlFor={`cname-${idx}`}>{t("form.colorName")}</Label>
                  <Input
                    id={`cname-${idx}`}
                    value={v.colorName}
                    onChange={(e) => setVariant(idx, "colorName", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`chex-${idx}`}>{t("form.colorHex")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`chex-${idx}`}
                      value={v.colorHex}
                      onChange={(e) => setVariant(idx, "colorHex", e.target.value)}
                      placeholder="#a8576b"
                      dir="ltr"
                    />
                    <span
                      className="border-border size-9 shrink-0 rounded-lg border"
                      style={{ backgroundColor: /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.colorHex) ? v.colorHex : "transparent" }}
                      aria-hidden
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`pover-${idx}`}>{t("form.priceOverride")}</Label>
                  <Input
                    id={`pover-${idx}`}
                    type="text"
                    inputMode="decimal"
                    value={v.priceOverride}
                    onChange={(e) => setVariant(idx, "priceOverride", e.target.value)}
                    dir="ltr"
                    className="text-end tabular-nums"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Errors + actions ────────────────────────────────────────── */}
      {error && (
        <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-sm">
          <AlertTriangle className="size-4" />
          {error}
        </p>
      )}
      {saved && (
        <p className="text-success inline-flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="size-4" />
          {t("form.saved")}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="animate-spin" /> : isEdit ? <Save /> : <PackagePlus />}
          {isSaving
            ? isEdit
              ? t("form.saving")
              : t("form.creating")
            : isEdit
              ? t("form.save")
              : t("form.create")}
        </Button>
        {isEdit && (
          <Button variant="ghost" onClick={onDelete} disabled={isDeleting} className="text-destructive hover:bg-destructive/10">
            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {isDeleting ? t("form.deleting") : t("form.delete")}
          </Button>
        )}
      </div>

      {/* ── B2B pricing (edit mode only — needs a persisted product) ──── */}
      {isEdit && product && (
        <Section title={t("form.sectionPricing")}>
          <TierPriceEditor
            productId={product.id}
            tiers={tiers}
            initial={product.tierPrices}
          />
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-foreground text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
