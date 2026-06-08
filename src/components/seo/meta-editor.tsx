"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, CheckCircle2, AlertTriangle, ArrowLeft, Code2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { saveProductSeo } from "@/lib/seo/actions";
import type { ProductSeoDetail } from "@/lib/seo/queries";

/**
 * Per-product SEO meta editor with a live Google-style snippet preview and a
 * read-only view of the generated Product JSON-LD. Saving persists the meta
 * and (server-side) regenerates + stores the JSON-LD on the SeoMeta row.
 */

const TITLE_MAX = 120;
const DESC_MAX = 320;

const ERROR_KEYS = [
  "metaTitleRequired",
  "metaDescriptionRequired",
  "notFound",
  "invalid",
  "unknown",
] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

export function MetaEditor({
  locale,
  product,
}: {
  locale: string;
  product: ProductSeoDetail;
}) {
  const t = useTranslations("seo.meta");
  const tErr = useTranslations("seo.errors");
  const router = useRouter();

  const [metaTitle, setMetaTitle] = useState(product.meta?.metaTitle ?? `${product.nameEn} | Dar Al-Amirat`);
  const [metaDescription, setMetaDescription] = useState(product.meta?.metaDescription ?? "");
  const [keywords, setKeywords] = useState(product.meta?.keywords ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSave] = useTransition();
  // Preview the JSON-LD that WILL be stored (mirrors the server builder).
  const previewJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nameEn,
    description: metaDescription || product.nameEn,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand },
    offers: {
      "@type": "Offer",
      priceCurrency: "SAR",
      price: product.basePrice,
      availability: "https://schema.org/InStock",
      url: product.path,
    },
  };
  const storedJsonLd = product.meta?.jsonLd;

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const res = await saveProductSeo({
        productId: product.id,
        metaTitle,
        metaDescription,
        keywords,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        window.setTimeout(() => setSaved(false), 2000);
      } else {
        const key: ErrorKey = (ERROR_KEYS as readonly string[]).includes(res.error)
          ? (res.error as ErrorKey)
          : "unknown";
        setError(tErr(key));
      }
    });
  };

  const textareaClass =
    "border-input bg-surface text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm shadow-soft transition-colors focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none aria-[invalid=true]:border-destructive";

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/seo")}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("back")}
      </button>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Form ───────────────────────────────────────────────── */}
        <section className="bg-card shadow-soft border-border flex flex-col gap-4 rounded-2xl border p-5">
          <h2 className="font-display text-foreground text-lg font-semibold">
            {t("editorTitle", { name: locale === "ar" ? product.nameAr : product.nameEn })}
          </h2>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="metaTitle">{t("metaTitle")}</Label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("charCount", { count: metaTitle.length, max: TITLE_MAX })}
              </span>
            </div>
            <Input
              id="metaTitle"
              value={metaTitle}
              maxLength={TITLE_MAX}
              onChange={(e) => setMetaTitle(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="metaDescription">{t("metaDescription")}</Label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("charCount", { count: metaDescription.length, max: DESC_MAX })}
              </span>
            </div>
            <textarea
              id="metaDescription"
              rows={3}
              value={metaDescription}
              maxLength={DESC_MAX}
              onChange={(e) => setMetaDescription(e.target.value)}
              className={textareaClass}
            />
          </div>

          <div>
            <Label htmlFor="keywords">{t("keywords")}</Label>
            <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </div>

          {error && (
            <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-sm">
              <AlertTriangle className="size-4" />
              {error}
            </p>
          )}
          {saved && (
            <p className="text-success inline-flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="size-4" />
              {t("saved")}
            </p>
          )}

          <div>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              {isSaving ? t("saving") : t("save")}
            </Button>
          </div>
        </section>

        {/* ── Live snippet preview + JSON-LD ─────────────────────── */}
        <div className="flex flex-col gap-4">
          <section className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {t("snippetPreview")}
            </h3>
            {/* Google-style SERP snippet */}
            <div dir="ltr" className="flex flex-col gap-1">
              <div className="text-muted-foreground truncate text-xs">
                daralamirat.sa › products{product.path}
              </div>
              <div className="truncate text-lg text-[#1a0dab]">
                {metaTitle || product.nameEn}
              </div>
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {metaDescription || "—"}
              </p>
            </div>
          </section>

          <section className="bg-card shadow-soft border-border flex flex-col gap-2 rounded-2xl border p-5">
            <h3 className="text-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
              <Code2 className="size-4" />
              {t("jsonLdTitle")}
            </h3>
            <p className="text-muted-foreground text-xs">{t("jsonLdHint")}</p>
            <pre
              dir="ltr"
              className="bg-surface-muted scrollbar-subtle text-foreground max-h-72 overflow-auto rounded-xl p-3 text-xs"
            >
              <code>{JSON.stringify(storedJsonLd ?? previewJsonLd, null, 2)}</code>
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
