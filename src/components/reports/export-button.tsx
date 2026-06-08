"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

interface ExportRow {
  [key: string]: string | number;
}

interface ExportButtonProps {
  filename: string;
  headers: string[];
  rows: ExportRow[];
}

export function ExportButton({ filename, headers, rows }: ExportButtonProps) {
  const t = useTranslations("reports");
  const [busy, setBusy] = useState(false);

  function downloadCsv() {
    setBusy(true);
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      headers.map(escape).join(","),
      ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={downloadCsv}
      disabled={busy}
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
    >
      <Download className="size-4" />
      {t("export")}
    </button>
  );
}
