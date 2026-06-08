"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2, FileDown } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { recordExportJob } from "@/lib/catalog/import-export/actions";

interface CategoryOption {
  slug: string;
  nameEn: string;
  nameAr: string;
}

export function ExportPanel({ categories, locale }: { categories: CategoryOption[]; locale: string }) {
  const t = useTranslations("catalog.importExportPage");
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === "ar";

  const [category, setCategory] = useState("");
  const [active, setActive] = useState("");
  const [isExporting, startExport] = useTransition();

  const onExport = () => {
    startExport(async () => {
      const res = await recordExportJob({
        categorySlug: category || undefined,
        active: active === "" ? undefined : active === "true",
      });
      if (!res.ok) {
        toast(t(`errors.${res.error}` as never), "error");
        return;
      }

      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (active) params.set("active", active);
      const qs = params.toString();
      window.location.href = `/api/catalog/export${qs ? `?${qs}` : ""}`;

      toast(t("exportStarted"), "success");
      router.refresh();
    });
  };

  return (
    <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="bg-primary-soft text-primary flex size-10 items-center justify-center rounded-xl">
          <FileDown className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-foreground text-base font-semibold">{t("export.title")}</h2>
          <p className="text-muted-foreground text-xs">{t("export.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="exp-category">{t("export.category")}</Label>
          <select
            id="exp-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">{t("export.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {isAr ? c.nameAr : c.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="exp-active">{t("export.status")}</Label>
          <select
            id="exp-active"
            value={active}
            onChange={(e) => setActive(e.target.value)}
            className="border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">{t("export.allStatuses")}</option>
            <option value="true">{t("export.activeOnly")}</option>
            <option value="false">{t("export.inactiveOnly")}</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={onExport} disabled={isExporting}>
          {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
          {isExporting ? t("export.exporting") : t("export.download")}
        </Button>
      </div>
    </section>
  );
}
