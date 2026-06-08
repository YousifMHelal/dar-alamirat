"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Circle,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveAppLayout } from "@/lib/content/actions";
import type { LayoutBlock, StoryItem } from "@/lib/content/schema";
import { useReorder, moveItem } from "./use-reorder";
import { SaveBar } from "./banner-editor";

/**
 * Mobile home-screen layout builder. The layout is an ordered list of blocks
 * (array order = vertical order on the app home screen). Two block kinds:
 * "stories" (a row of story circles) and "categoryGrid" (a grid bound to
 * catalog categories). Blocks reorder by drag or arrows; the whole layout is
 * saved as one JSON Setting row. A live preview mirrors the configured blocks.
 */

type Category = { id: string; nameEn: string; nameAr: string };

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;
const newStory = (): StoryItem => ({ id: uid("s"), imageUrl: "", labelAr: "", labelEn: "" });
const newStoriesBlock = (): LayoutBlock => ({
  id: uid("blk"),
  type: "stories",
  titleAr: "",
  titleEn: "",
  items: [newStory()],
});
const newGridBlock = (): LayoutBlock => ({
  id: uid("blk"),
  type: "categoryGrid",
  titleAr: "",
  titleEn: "",
  columns: 2,
  categoryIds: [],
});

const ERROR_KEYS = ["imageUrlInvalid", "invalid", "unknown"] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

export function LayoutBuilder({
  locale,
  initial,
  categories,
}: {
  locale: string;
  initial: LayoutBlock[];
  categories: Category[];
}) {
  const t = useTranslations("content.layout");
  const tc = useTranslations("content.common");
  const tErr = useTranslations("content.errors");
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<LayoutBlock[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const mutate = (next: LayoutBlock[]) => {
    setBlocks(next);
    setDirty(true);
    setSaved(false);
  };

  const { dragProps } = useReorder((from, to) => mutate(moveItem(blocks, from, to)));

  const updateBlock = (id: string, patch: Partial<LayoutBlock>) =>
    mutate(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as LayoutBlock) : b)));
  const removeBlock = (id: string) => mutate(blocks.filter((b) => b.id !== id));
  const moveBlock = (index: number, dir: -1 | 1) => mutate(moveItem(blocks, index, index + dir));

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const res = await saveAppLayout({ blocks });
      if (res.ok) {
        setDirty(false);
        setSaved(true);
        toast(tc("saved"), "success");
        window.setTimeout(() => setSaved(false), 2000);
      } else {
        const key: ErrorKey = (ERROR_KEYS as readonly string[]).includes(res.error)
          ? (res.error as ErrorKey)
          : "unknown";
        const msg = tErr(key);
        setError(msg);
        toast(msg, "error");
      }
    });
  };

  const catName = (c: Category) => (locale === "ar" ? c.nameAr : c.nameEn);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* ── Builder ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="font-display text-foreground text-lg font-semibold">{t("title")}</h2>
            <p className="text-muted-foreground text-xs">{tc("dragHint")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => mutate([...blocks, newStoriesBlock()])}>
              <Circle />
              {t("addStories")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => mutate([...blocks, newGridBlock()])}>
              <LayoutGrid />
              {t("addGrid")}
            </Button>
          </div>
        </div>

        {blocks.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {blocks.map((block, idx) => (
              <li
                key={block.id}
                {...dragProps(idx)}
                className="bg-card shadow-soft border-border data-[drag-over=true]:border-primary flex gap-3 rounded-2xl border p-4 transition-colors"
              >
                <div className="flex flex-col items-center gap-1 pt-1">
                  <span className="text-muted-foreground hidden cursor-grab active:cursor-grabbing sm:block">
                    <GripVertical className="size-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, -1)}
                    disabled={idx === 0}
                    aria-label={tc("moveUp")}
                    className="text-muted-foreground hover:bg-muted flex size-7 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, 1)}
                    disabled={idx === blocks.length - 1}
                    aria-label={tc("moveDown")}
                    className="text-muted-foreground hover:bg-muted flex size-7 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-primary-soft text-sidebar-active-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
                      {block.type === "stories" ? <Circle className="size-3" /> : <LayoutGrid className="size-3" />}
                      {block.type === "stories" ? t("stories") : t("categoryGrid")}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      aria-label={tc("remove")}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex size-7 items-center justify-center rounded-lg transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {/* Bilingual block title */}
                  <div>
                    <Label>{t("blockTitle")}</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <LangInput
                        lang={tc("ar")}
                        dir="rtl"
                        value={block.titleAr ?? ""}
                        onChange={(v) => updateBlock(block.id, { titleAr: v })}
                      />
                      <LangInput
                        lang={tc("en")}
                        dir="ltr"
                        value={block.titleEn ?? ""}
                        onChange={(v) => updateBlock(block.id, { titleEn: v })}
                      />
                    </div>
                  </div>

                  {block.type === "stories" ? (
                    <StoriesEditor
                      block={block}
                      onChange={(items) => updateBlock(block.id, { items })}
                      labels={{
                        items: t("storyItems"),
                        add: t("addStory"),
                        label: t("label"),
                        imageUrl: t("imageUrl"),
                        ar: tc("ar"),
                        en: tc("en"),
                        remove: tc("remove"),
                      }}
                    />
                  ) : (
                    <GridEditor
                      block={block}
                      categories={categories}
                      catName={catName}
                      onColumns={(columns) => updateBlock(block.id, { columns })}
                      onCategories={(categoryIds) => updateBlock(block.id, { categoryIds })}
                      labels={{
                        columns: t("columns"),
                        categories: t("categories"),
                        selectCategories: t("selectCategories"),
                      }}
                    />
                  )}
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

      {/* ── Live phone preview ───────────────────────────────────── */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          {t("preview")}
        </p>
        <PhonePreview locale={locale} blocks={blocks} categories={categories} catName={catName} />
      </div>
    </div>
  );
}

function LangInput({
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

function StoriesEditor({
  block,
  onChange,
  labels,
}: {
  block: Extract<LayoutBlock, { type: "stories" }>;
  onChange: (items: StoryItem[]) => void;
  labels: { items: string; add: string; label: string; imageUrl: string; ar: string; en: string; remove: string };
}) {
  const update = (id: string, patch: Partial<StoryItem>) =>
    onChange(block.items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id: string) => onChange(block.items.filter((it) => it.id !== id));
  const add = () => onChange([...block.items, newStory()]);

  return (
    <div className="flex flex-col gap-2">
      <Label>{labels.items}</Label>
      <div className="flex flex-col gap-2">
        {block.items.map((it) => (
          <div key={it.id} className="border-border bg-surface-muted/40 flex items-center gap-2 rounded-xl border p-2">
            <span
              className="border-border bg-surface size-10 shrink-0 overflow-hidden rounded-full border"
              aria-hidden
            >
              {it.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.imageUrl} alt="" className="size-full object-cover" />
              )}
            </span>
            <Input
              value={it.imageUrl}
              onChange={(e) => update(it.id, { imageUrl: e.target.value })}
              placeholder={labels.imageUrl}
              dir="ltr"
              className="h-9 flex-1"
            />
            <Input
              value={it.labelAr ?? ""}
              onChange={(e) => update(it.id, { labelAr: e.target.value })}
              placeholder={labels.ar}
              dir="rtl"
              className="h-9 w-24"
            />
            <Input
              value={it.labelEn ?? ""}
              onChange={(e) => update(it.id, { labelEn: e.target.value })}
              placeholder={labels.en}
              dir="ltr"
              className="h-9 w-24"
            />
            <button
              type="button"
              onClick={() => remove(it.id)}
              aria-label={labels.remove}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={add} className="self-start">
        <Plus />
        {labels.add}
      </Button>
    </div>
  );
}

function GridEditor({
  block,
  categories,
  catName,
  onColumns,
  onCategories,
  labels,
}: {
  block: Extract<LayoutBlock, { type: "categoryGrid" }>;
  categories: Category[];
  catName: (c: Category) => string;
  onColumns: (n: number) => void;
  onCategories: (ids: string[]) => void;
  labels: { columns: string; categories: string; selectCategories: string };
}) {
  const toggle = (id: string) =>
    onCategories(
      block.categoryIds.includes(id)
        ? block.categoryIds.filter((c) => c !== id)
        : [...block.categoryIds, id],
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Label className="mb-0">{labels.columns}</Label>
        <div className="flex gap-1">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onColumns(n)}
              className={`flex size-8 items-center justify-center rounded-lg border text-sm tabular-nums transition-colors ${
                block.columns === n
                  ? "border-primary bg-primary-soft text-sidebar-active-foreground font-semibold"
                  : "border-border bg-surface text-muted-foreground hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>{labels.categories}</Label>
        <p className="text-muted-foreground mb-2 text-xs">{labels.selectCategories}</p>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const on = block.categoryIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  on
                    ? "border-primary bg-primary-soft text-sidebar-active-foreground font-medium"
                    : "border-border bg-surface text-muted-foreground hover:bg-muted"
                }`}
              >
                {catName(c)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A simplified phone frame rendering the configured blocks in order. */
function PhonePreview({
  locale,
  blocks,
  categories,
  catName,
}: {
  locale: string;
  blocks: LayoutBlock[];
  categories: Category[];
  catName: (c: { id: string; nameEn: string; nameAr: string }) => string;
}) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const title = (ar?: string, en?: string) => (locale === "ar" ? ar : en) || "";

  return (
    <div className="border-border bg-surface-muted mx-auto w-full max-w-[280px] overflow-hidden rounded-[2rem] border-4 p-3">
      <div className="bg-card flex flex-col gap-4 rounded-[1.4rem] p-3">
        {blocks.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-xs">—</p>
        )}
        {blocks.map((block) => (
          <div key={block.id} className="flex flex-col gap-2">
            {(block.titleAr || block.titleEn) && (
              <p className="text-foreground text-xs font-semibold">{title(block.titleAr, block.titleEn)}</p>
            )}
            {block.type === "stories" ? (
              <div className="scrollbar-subtle flex gap-2 overflow-x-auto">
                {block.items.map((it) => (
                  <div key={it.id} className="flex shrink-0 flex-col items-center gap-1">
                    <span className="border-primary/40 bg-muted size-12 overflow-hidden rounded-full border-2">
                      {it.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.imageUrl} alt="" className="size-full object-cover" />
                      )}
                    </span>
                    <span className="text-muted-foreground max-w-12 truncate text-[9px]">
                      {title(it.labelAr, it.labelEn)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${block.columns}, minmax(0, 1fr))` }}
              >
                {block.categoryIds.map((id) => {
                  const c = catById.get(id);
                  return (
                    <div
                      key={id}
                      className="bg-primary-soft text-sidebar-active-foreground flex aspect-square items-center justify-center rounded-lg p-1 text-center text-[9px] font-medium"
                    >
                      {c ? catName(c) : "—"}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
