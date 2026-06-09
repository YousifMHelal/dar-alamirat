"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, X, ArrowUpCircle, GitBranch, Loader2, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { searchProductsAction, setProductLinks } from "@/lib/catalog/actions";
import type { ProductLinkRow } from "@/lib/catalog/queries";

interface SectionProps {
  productId: string;
  type: "CROSS_SELL" | "UP_SELL";
  initial: ProductLinkRow[];
  locale: string;
}

function LinksSection({ productId, type, initial, locale }: SectionProps) {
  const t = useTranslations("catalog.links");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ProductLinkRow[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductLinkRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const name = (p: ProductLinkRow) => locale === "ar" ? p.nameAr : p.nameEn;
  const selectedIds = selected.map((p) => p.id);
  const selectedIdsKey = selectedIds.join(",");

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const excluded = [productId, ...selectedIds];
        const res = await searchProductsAction(query, excluded);
        setResults(res);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedIdsKey, productId]);

  const add = useCallback((p: ProductLinkRow) => {
    setSelected((prev) => [...prev, p]);
    setQuery("");
    setResults([]);
  }, []);

  const remove = useCallback((id: string) => {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const save = () => {
    startTransition(async () => {
      const res = await setProductLinks(productId, type, selectedIds);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        toast(t("saveError"), "error");
      }
    });
  };

  const isCross = type === "CROSS_SELL";
  const Icon = isCross ? GitBranch : ArrowUpCircle;
  const accentClass = isCross ? "text-blue-600" : "text-amber-600";
  const chipClass = isCross
    ? "bg-blue-50 border-blue-200 text-blue-800"
    : "bg-amber-50 border-amber-200 text-amber-800";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", accentClass)} />
        <span className="text-sm font-semibold">
          {isCross ? t("crossSellTitle") : t("upSellTitle")}
        </span>
        <span className="text-muted-foreground text-xs">
          — {isCross ? t("crossSellHint") : t("upSellHint")}
        </span>
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((p) => (
            <span
              key={p.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                chipClass,
              )}
            >
              {p.imageUrl && (
                <Image
                  src={p.imageUrl}
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 rounded-full object-cover"
                />
              )}
              {name(p)}
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="hover:opacity-70"
                aria-label={t("remove")}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute inset-s-3 top-1/2 size-4 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="border-input bg-surface text-foreground placeholder:text-muted-foreground h-9 w-full rounded-lg border ps-9 pe-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        {searching && (
          <Loader2 className="text-muted-foreground absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
        )}
        {results.length > 0 && (
          <div className="border-border bg-surface absolute z-20 mt-1 w-full overflow-hidden rounded-lg border shadow-lg">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                className="hover:bg-muted flex w-full items-center gap-3 px-3 py-2 text-start text-sm"
              >
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 rounded object-cover"
                  />
                ) : (
                  <span className="bg-muted size-7 rounded" />
                )}
                <span className="flex-1 truncate">{name(p)}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{p.sku}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={save}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="text-green-600" />
          ) : null}
          {isPending ? t("saving") : saved ? t("saved") : t("save")}
        </Button>
      </div>
    </div>
  );
}

interface Props {
  productId: string;
  locale: string;
  crossSell: ProductLinkRow[];
  upSell: ProductLinkRow[];
}

export function ProductLinksEditor({ productId, locale, crossSell, upSell }: Props) {
  const t = useTranslations("catalog.links");

  return (
    <section className="bg-surface border-border flex flex-col gap-6 rounded-xl border p-5">
      <div>
        <h2 className="text-base font-semibold">{t("sectionTitle")}</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {t("sectionSubtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <LinksSection
          productId={productId}
          type="CROSS_SELL"
          initial={crossSell}
          locale={locale}
        />
        <div className="border-border border-t" />
        <LinksSection
          productId={productId}
          type="UP_SELL"
          initial={upSell}
          locale={locale}
        />
      </div>
    </section>
  );
}
