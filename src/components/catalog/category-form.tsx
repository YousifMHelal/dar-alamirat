"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Save,
  FolderPlus,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ImageOff,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/catalog/actions";
import type { CategoryDetail } from "@/lib/catalog/queries";

const ERROR_KEYS = [
  "nameArRequired",
  "nameEnRequired",
  "slugRequired",
  "slugInvalid",
  "slugTaken",
  "imageUrlInvalid",
  "categoryInUse",
  "notFound",
  "unknown",
] as const;

type ErrorKey = (typeof ERROR_KEYS)[number];

function translateError(
  t: ReturnType<typeof useTranslations<"categories">>,
  error: string,
): string {
  const key: ErrorKey = (ERROR_KEYS as readonly string[]).includes(error)
    ? (error as ErrorKey)
    : "unknown";
  return t(`form.errors.${key}` as const);
}

export function CategoryForm({ category }: { category?: CategoryDetail }) {
  const t = useTranslations("categories");
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = Boolean(category);

  const [form, setForm] = useState({
    nameEn: category?.nameEn ?? "",
    nameAr: category?.nameAr ?? "",
    slug: category?.slug ?? "",
    imageUrl: category?.imageUrl ?? "",
  });

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleNameEnChange = (v: string) => {
    set("nameEn", v);
    if (!isEdit) {
      set(
        "slug",
        v
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-"),
      );
    }
  };

  const onSave = () => {
    setError(null);
    setSaved(false);
    const payload = {
      nameEn: form.nameEn,
      nameAr: form.nameAr,
      slug: form.slug,
      imageUrl: form.imageUrl,
    };

    startSave(async () => {
      const res =
        isEdit && category
          ? await updateCategory({ ...payload, id: category.id })
          : await createCategory(payload);

      if (res.ok) {
        if (isEdit) {
          setSaved(true);
          toast(t("form.saved"), "success");
          router.refresh();
        } else {
          router.push(`/catalog/categories/${res.categoryId}`);
        }
      } else {
        const msg = translateError(t, res.error);
        setError(msg);
        toast(msg, "error");
      }
    });
  };

  const onDelete = () => {
    if (!category) return;
    if (!window.confirm(t("form.confirmDelete"))) return;
    setError(null);
    startDelete(async () => {
      const res = await deleteCategory(category.id);
      if (res.ok) router.push("/catalog/categories");
      else setError(translateError(t, res.error));
    });
  };

  const imageValid = /^https?:\/\/.+/.test(form.imageUrl);

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
        <h2 className="font-display text-foreground mb-4 text-base font-semibold">
          {t("form.sectionDetails")}
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nameEn">{t("form.nameEn")}</Label>
            <Input
              id="nameEn"
              value={form.nameEn}
              onChange={(e) => handleNameEnChange(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <Label htmlFor="nameAr">{t("form.nameAr")}</Label>
            <Input
              id="nameAr"
              value={form.nameAr}
              onChange={(e) => set("nameAr", e.target.value)}
              dir="rtl"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="slug">{t("form.slug")}</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              dir="ltr"
              placeholder="e.g. hair-care"
              className="font-mono"
            />
            <p className="text-muted-foreground mt-1 text-xs">{t("form.slugHint")}</p>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="imageUrl">{t("form.imageUrl")}</Label>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Input
                  id="imageUrl"
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => set("imageUrl", e.target.value)}
                  placeholder="https://example.com/category.jpg"
                  dir="ltr"
                />
              </div>
              <div className="border-border bg-surface-muted/40 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                {imageValid ? (
                  <Image
                    src={form.imageUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="size-full object-cover"
                    unoptimized
                  />
                ) : (
                  <ImageOff className="text-muted-foreground size-5" />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

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
          {isSaving ? (
            <Loader2 className="animate-spin" />
          ) : isEdit ? (
            <Save />
          ) : (
            <FolderPlus />
          )}
          {isSaving
            ? isEdit
              ? t("form.saving")
              : t("form.creating")
            : isEdit
              ? t("form.save")
              : t("form.create")}
        </Button>
        {isEdit && (
          <Button
            variant="ghost"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-destructive hover:bg-destructive/10"
          >
            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {isDeleting ? t("form.deleting") : t("form.delete")}
          </Button>
        )}
      </div>
    </div>
  );
}
