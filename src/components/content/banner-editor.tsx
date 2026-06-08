"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  ImageOff,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { saveBanners } from "@/lib/content/actions";
import type { Banner } from "@/lib/content/schema";
import { useReorder, moveItem } from "./use-reorder";

/**
 * Storefront banner/slider editor. Banners are an ordered list (array order =
 * display order); each has an image URL, bilingual titles edited side-by-side
 * (AR | EN), an optional link, and an active flag. Reorder by dragging the
 * handle or with the up/down buttons. Save persists the whole list as one
 * JSON Setting row.
 */

let bannerSeq = 0;
const newBanner = (): Banner => ({
  id: `b-${Date.now()}-${bannerSeq++}`,
  imageUrl: "",
  titleAr: "",
  titleEn: "",
  link: "",
  active: true,
});

const ERROR_KEYS = ["imageUrlInvalid", "invalid", "unknown"] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

export function BannerEditor({ initial }: { initial: Banner[] }) {
  const t = useTranslations("content.banners");
  const tc = useTranslations("content.common");
  const tErr = useTranslations("content.errors");
  const [banners, setBanners] = useState<Banner[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSave] = useTransition();

  const mutate = (next: Banner[]) => {
    setBanners(next);
    setDirty(true);
    setSaved(false);
  };

  const { dragProps } = useReorder((from, to) => mutate(moveItem(banners, from, to)));

  const update = (id: string, patch: Partial<Banner>) =>
    mutate(banners.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const remove = (id: string) => mutate(banners.filter((b) => b.id !== id));
  const add = () => mutate([...banners, newBanner()]);
  const move = (index: number, dir: -1 | 1) => mutate(moveItem(banners, index, index + dir));

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const res = await saveBanners({ banners });
      if (res.ok) {
        setDirty(false);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2000);
      } else {
        const key: ErrorKey = (ERROR_KEYS as readonly string[]).includes(res.error)
          ? (res.error as ErrorKey)
          : "unknown";
        setError(tErr(key));
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="font-display text-foreground text-lg font-semibold">{t("title")}</h2>
          <p className="text-muted-foreground text-xs">{tc("dragHint")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={add}>
          <Plus />
          {t("add")}
        </Button>
      </div>

      {banners.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {banners.map((banner, idx) => (
            <li
              key={banner.id}
              {...dragProps(idx)}
              className="bg-card shadow-soft border-border data-[drag-over=true]:border-primary flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:flex-row"
            >
              {/* Drag handle + reorder buttons */}
              <div className="flex flex-row items-center gap-1 sm:flex-col sm:pt-1">
                <span className="text-muted-foreground hidden cursor-grab active:cursor-grabbing sm:block">
                  <GripVertical className="size-4" />
                </span>
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label={tc("moveUp")}
                  className="text-muted-foreground hover:bg-muted flex size-7 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === banners.length - 1}
                  aria-label={tc("moveDown")}
                  className="text-muted-foreground hover:bg-muted flex size-7 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>

              {/* Image preview */}
              <div className="border-border bg-surface-muted flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border sm:w-48">
                {banner.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={banner.imageUrl}
                    alt={banner.titleEn || banner.titleAr || ""}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
                    <ImageOff className="size-5" />
                    {t("noImage")}
                  </span>
                )}
              </div>

              {/* Fields */}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {t("slide", { n: idx + 1 })}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="text-foreground flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={banner.active}
                        onChange={(e) => update(banner.id, { active: e.target.checked })}
                        className="border-input text-primary focus-visible:ring-ring/30 size-3.5 rounded border focus-visible:ring-2"
                      />
                      {tc("active")}
                    </label>
                    <button
                      type="button"
                      onClick={() => remove(banner.id)}
                      aria-label={tc("remove")}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex size-7 items-center justify-center rounded-lg transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor={`img-${banner.id}`}>{t("imageUrl")}</Label>
                  <Input
                    id={`img-${banner.id}`}
                    value={banner.imageUrl}
                    onChange={(e) => update(banner.id, { imageUrl: e.target.value })}
                    placeholder="https://…"
                    dir="ltr"
                  />
                </div>

                {/* Bilingual side-by-side title */}
                <div>
                  <Label>{t("titleField")}</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <BilingualInput
                      lang={tc("ar")}
                      dir="rtl"
                      value={banner.titleAr ?? ""}
                      onChange={(v) => update(banner.id, { titleAr: v })}
                    />
                    <BilingualInput
                      lang={tc("en")}
                      dir="ltr"
                      value={banner.titleEn ?? ""}
                      onChange={(v) => update(banner.id, { titleEn: v })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`link-${banner.id}`}>{t("link")}</Label>
                  <div className="relative">
                    <LinkIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      id={`link-${banner.id}`}
                      value={banner.link ?? ""}
                      onChange={(e) => update(banner.id, { link: e.target.value })}
                      placeholder="/offers"
                      dir="ltr"
                      className="ps-9"
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SaveBar
        dirty={dirty}
        saved={saved}
        error={error}
        isSaving={isSaving}
        onSave={onSave}
        labels={{ save: tc("save"), saving: tc("saving"), saved: tc("saved"), unsaved: tc("unsaved") }}
      />
    </div>
  );
}

/** Small labelled input used for the AR | EN side-by-side fields. */
function BilingualInput({
  lang,
  dir,
  value,
  onChange,
}: {
  lang: string;
  dir: "rtl" | "ltr";
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="bg-muted text-muted-foreground absolute top-1/2 z-10 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] font-semibold end-2">
        {lang}
      </span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} dir={dir} className="pe-10" />
    </div>
  );
}

/** Sticky-ish save bar shared by both content editors. */
export function SaveBar({
  dirty,
  saved,
  error,
  isSaving,
  onSave,
  labels,
}: {
  dirty: boolean;
  saved: boolean;
  error: string | null;
  isSaving: boolean;
  onSave: () => void;
  labels: { save: string; saving: string; saved: string; unsaved: string };
}) {
  return (
    <div className="flex items-center gap-3">
      <Button onClick={onSave} disabled={isSaving || !dirty}>
        {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
        {isSaving ? labels.saving : labels.save}
      </Button>
      {dirty && !saved && (
        <span className="text-muted-foreground text-xs">{labels.unsaved}</span>
      )}
      {saved && (
        <span className="text-success inline-flex items-center gap-1.5 text-xs">
          <CheckCircle2 className="size-4" />
          {labels.saved}
        </span>
      )}
      {error && (
        <span role="alert" className="text-destructive inline-flex items-center gap-1.5 text-xs">
          <AlertTriangle className="size-4" />
          {error}
        </span>
      )}
    </div>
  );
}
