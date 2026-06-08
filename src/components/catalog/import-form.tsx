"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { importCatalog, type ImportSummary } from "@/lib/catalog/import/actions";

/**
 * Bulk-import UI: pick a .xlsx, POST it to the import server action via
 * FormData, and render the REAL result log it returns — counts of
 * created/updated products & variants plus every failed row with its reason.
 * The template is a normal download link to the API route.
 */

// All importer error keys → catalog.importPage.errors.*
const ERROR_KEYS = [
  "noFile",
  "fileTooLarge",
  "parseFailed",
  "noSheet",
  "empty",
  "missingColumn",
  "skuRequired",
  "nameEnRequired",
  "nameArRequired",
  "brandRequired",
  "variantSkuRequired",
  "categoryRequired",
  "categoryUnknown",
  "basePriceInvalid",
  "priceInvalid",
  "hexInvalid",
  "variantSkuDuplicate",
  "variantSkuOwnedByOther",
  "skuConflict",
  "importRowFailed",
  "unknown",
] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

export function ImportForm({ locale }: { locale: string }) {
  const t = useTranslations("catalog.importPage");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isUploading, startUpload] = useTransition();

  const tErr = (key: string) => {
    const k: ErrorKey = (ERROR_KEYS as readonly string[]).includes(key)
      ? (key as ErrorKey)
      : "unknown";
    return t(`errors.${k}` as const);
  };

  const onUpload = () => {
    if (!file) {
      setTopError(t("errors.noFile"));
      return;
    }
    setTopError(null);
    setSummary(null);
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const res = await importCatalog(fd);
      if (res.ok) setSummary(res.summary);
      else setTopError(tErr(res.error));
    });
  };

  const reset = () => {
    setFile(null);
    setSummary(null);
    setTopError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Result view ───────────────────────────────────────────────────
  if (summary) {
    const stats = [
      { label: t("productsCreated"), value: summary.productsCreated, tone: "success" as const },
      { label: t("productsUpdated"), value: summary.productsUpdated, tone: "info" as const },
      { label: t("variantsCreated"), value: summary.variantsCreated, tone: "success" as const },
      { label: t("variantsUpdated"), value: summary.variantsUpdated, tone: "info" as const },
      { label: t("rowsProcessed"), value: summary.totalRows, tone: "neutral" as const },
    ];
    const toneClass: Record<string, string> = {
      success: "bg-success/12 text-success",
      info: "bg-accent/15 text-accent-foreground",
      neutral: "bg-muted text-foreground",
    };

    return (
      <section className="bg-card shadow-soft border-border flex flex-col gap-5 rounded-2xl border p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-foreground text-lg font-semibold">{t("resultTitle")}</h2>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw />
            {t("reset")}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="border-border rounded-xl border p-3 text-center">
              <div className={`mx-auto mb-1.5 flex size-9 items-center justify-center rounded-lg ${toneClass[s.tone]}`}>
                <span className="text-sm font-semibold tabular-nums">{formatNumber(s.value, locale)}</span>
              </div>
              <p className="text-muted-foreground text-xs">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Succeeded rows */}
        {summary.log.length > 0 && (
          <div>
            <h3 className="text-foreground mb-2 inline-flex items-center gap-1.5 text-sm font-semibold">
              <CheckCircle2 className="text-success size-4" />
              {t("succeededTitle")}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {summary.log.map((row, i) => (
                <li
                  key={i}
                  className="border-border bg-surface flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="text-foreground font-mono text-xs">{row.sku}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.action === "created"
                          ? "bg-success/12 text-success"
                          : "bg-accent/15 text-accent-foreground"
                      }`}
                    >
                      {row.action === "created"
                        ? t("created", { count: 1 })
                        : t("updated", { count: 1 })}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatNumber(row.variants, locale)}×
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Failed rows */}
        {summary.errors.length > 0 ? (
          <div>
            <h3 className="text-foreground mb-2 inline-flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangle className="text-destructive size-4" />
              {t("failedTitle")} · {formatNumber(summary.errors.length, locale)}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {summary.errors.map((e, i) => (
                <li
                  key={i}
                  className="border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {e.row > 0 ? t("rowLabel", { row: e.row }) : "—"}
                    {e.column ? ` · ${e.column}` : ""}
                  </span>
                  <span className="text-destructive text-xs">{tErr(e.message)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-success inline-flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="size-4" />
            {t("noErrors")}
          </p>
        )}
      </section>
    );
  }

  // ── Upload view ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      <section className="bg-card shadow-soft border-border flex flex-col gap-4 rounded-2xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-foreground text-base font-semibold">{t("howTitle")}</h2>
          <a href="/api/catalog/template" download>
            <Button variant="outline" size="sm">
              <Download />
              {t("downloadTemplate")}
            </Button>
          </a>
        </div>
        <ol className="text-muted-foreground flex list-inside list-decimal flex-col gap-1.5 text-sm leading-relaxed">
          <li>{t("how1")}</li>
          <li>{t("how2")}</li>
          <li>{t("how3")}</li>
        </ol>
      </section>

      <section className="bg-card shadow-soft border-border flex flex-col gap-4 rounded-2xl border p-5">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragOver ? "border-primary bg-primary-soft/40" : "border-border hover:border-border-strong"
          }`}
        >
          <span className="bg-primary-soft text-primary flex size-12 items-center justify-center rounded-2xl">
            <FileSpreadsheet className="size-6" />
          </span>
          {file ? (
            <p className="text-foreground text-sm font-medium">{t("selectedFile", { name: file.name })}</p>
          ) : (
            <p className="text-muted-foreground text-sm">{t("dropzone")}</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>

        {topError && (
          <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-sm">
            <AlertTriangle className="size-4" />
            {topError}
          </p>
        )}

        <div>
          <Button onClick={onUpload} disabled={isUploading || !file}>
            {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {isUploading ? t("uploading") : t("upload")}
          </Button>
        </div>
      </section>
    </div>
  );
}
