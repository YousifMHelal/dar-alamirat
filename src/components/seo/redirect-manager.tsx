"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  X,
  Upload,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { saveRedirect, deleteRedirect, importRedirects } from "@/lib/seo/actions";
import type { RedirectRow } from "@/lib/seo/queries";

/**
 * Redirect manager: CRUD for 301/302 redirects plus a bulk-import modal
 * (one "from,to,type" per line). All writes go through the server actions;
 * the list refreshes via router.refresh() on success.
 */

type RType = "PERMANENT_301" | "TEMPORARY_302";

const ERROR_KEYS = [
  "pathRequired",
  "pathMustStartSlash",
  "fromPathTaken",
  "samePathLoop",
  "noRows",
  "invalid",
  "unknown",
] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

export function RedirectManager({ initial }: { initial: RedirectRow[] }) {
  const t = useTranslations("seo.redirects");
  const tErr = useTranslations("seo.errors");
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  const errKey = (e: string): ErrorKey =>
    (ERROR_KEYS as readonly string[]).includes(e) ? (e as ErrorKey) : "unknown";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-foreground text-lg font-semibold">{t("title")}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
            <Upload />
            {t("import")}
          </Button>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus />
              {t("add")}
            </Button>
          )}
        </div>
      </div>

      {importing && (
        <ImportPanel
          tErr={(e) => tErr(errKey(e))}
          onDone={() => {
            setImporting(false);
            router.refresh();
          }}
          onClose={() => setImporting(false)}
        />
      )}

      {adding && (
        <RedirectForm
          tErr={(e) => tErr(errKey(e))}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {initial.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-200 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("from")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("to")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("type")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("active")}</th>
                  <th className="px-4 py-3 text-end font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {initial.map((r) => (
                  <RedirectRowView
                    key={r.id}
                    row={r}
                    label={t}
                    tErr={(e) => tErr(errKey(e))}
                    onChanged={() => router.refresh()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RedirectRowView({
  row,
  label,
  tErr,
  onChanged,
}: {
  row: RedirectRow;
  label: ReturnType<typeof useTranslations<"seo.redirects">>;
  tErr: (e: string) => string;
  onChanged: () => void;
}) {
  const [isBusy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggleActive = () => {
    setError(null);
    startBusy(async () => {
      const res = await saveRedirect({ ...row, active: !row.active });
      if (res.ok) onChanged();
      else setError(tErr(res.error));
    });
  };
  const onDelete = () => {
    if (!window.confirm(label("confirmDelete"))) return;
    setError(null);
    startBusy(async () => {
      const res = await deleteRedirect(row.id);
      if (res.ok) onChanged();
      else setError(tErr(res.error));
    });
  };

  return (
    <tr className="border-border hover:bg-muted/40 border-b transition-colors last:border-0">
      <td className="text-foreground px-4 py-3 font-mono text-xs" dir="ltr">
        {row.fromPath}
      </td>
      <td className="text-foreground px-4 py-3 font-mono text-xs" dir="ltr">
        {row.toPath}
      </td>
      <td className="px-4 py-3">
        <Badge tone={row.type === "PERMANENT_301" ? "info" : "neutral"}>
          {label(`type_${row.type}`)}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={toggleActive}
          disabled={isBusy}
          className="inline-flex items-center"
          aria-label={label("active")}
        >
          {row.active ? (
            <Badge tone="success">{label("active")}</Badge>
          ) : (
            <Badge tone="neutral">—</Badge>
          )}
        </button>
        {error && (
          <p className="text-destructive mt-1 inline-flex items-center gap-1 text-xs">
            <AlertTriangle className="size-3" />
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-end">
        <button
          type="button"
          onClick={onDelete}
          disabled={isBusy}
          aria-label={label("delete")}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-flex size-8 items-center justify-center rounded-lg transition-colors"
        >
          {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </td>
    </tr>
  );
}

function RedirectForm({
  tErr,
  onDone,
  onCancel,
}: {
  tErr: (e: string) => string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("seo.redirects");
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [type, setType] = useState<RType>("PERMANENT_301");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const onSubmit = () => {
    setError(null);
    startSave(async () => {
      const res = await saveRedirect({ fromPath, toPath, type, active: true });
      if (res.ok) onDone();
      else setError(tErr(res.error));
    });
  };

  const selectClass =
    "border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="bg-card shadow-soft border-border flex flex-col gap-4 rounded-2xl border p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="from">{t("from")}</Label>
          <Input id="from" value={fromPath} onChange={(e) => setFromPath(e.target.value)} placeholder="/old-path" dir="ltr" />
        </div>
        <div>
          <Label htmlFor="to">{t("to")}</Label>
          <Input id="to" value={toPath} onChange={(e) => setToPath(e.target.value)} placeholder="/new-path" dir="ltr" />
        </div>
        <div>
          <Label htmlFor="type">{t("type")}</Label>
          <select id="type" value={type} onChange={(e) => setType(e.target.value as RType)} className={selectClass}>
            <option value="PERMANENT_301">{t("type_PERMANENT_301")}</option>
            <option value="TEMPORARY_302">{t("type_TEMPORARY_302")}</option>
          </select>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-sm">
          <AlertTriangle className="size-4" />
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button onClick={onSubmit} disabled={isSaving || !fromPath || !toPath}>
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          {isSaving ? t("saving") : t("save")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X />
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

function ImportPanel({
  tErr,
  onDone,
  onClose,
}: {
  tErr: (e: string) => string;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("seo.redirects");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [isImporting, startImport] = useTransition();

  /** Parse "from,to,type" lines into validated redirect rows. */
  const parseLines = () => {
    const rows: { fromPath: string; toPath: string; type: RType }[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [from, to, typeRaw] = trimmed.split(",").map((s) => s.trim());
      if (!from || !to) continue;
      const type: RType = typeRaw === "302" ? "TEMPORARY_302" : "PERMANENT_301";
      rows.push({ fromPath: from, toPath: to, type });
    }
    return rows;
  };

  const onImport = () => {
    setError(null);
    setResult(null);
    const rows = parseLines();
    if (rows.length === 0) {
      setError(tErr("noRows"));
      return;
    }
    startImport(async () => {
      const res = await importRedirects({ redirects: rows });
      if (res.ok) {
        setResult({ created: res.created, skipped: res.skipped });
        onDone();
      } else {
        setError(tErr(res.error));
      }
    });
  };

  return (
    <div className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">{t("importTitle")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:bg-muted flex size-8 items-center justify-center rounded-lg transition-colors"
          aria-label={t("importClose")}
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="text-muted-foreground text-xs">{t("importHint")}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        dir="ltr"
        placeholder={t("importPlaceholder")}
        className="border-input bg-surface text-foreground w-full rounded-lg border px-3 py-2 font-mono text-xs shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
      />
      {error && (
        <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-sm">
          <AlertTriangle className="size-4" />
          {error}
        </p>
      )}
      {result && (
        <p className="text-success text-sm">
          {t("imported", { created: result.created, skipped: result.skipped })}
        </p>
      )}
      <div>
        <Button onClick={onImport} disabled={isImporting || !text.trim()}>
          {isImporting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          {isImporting ? t("importing") : t("doImport")}
        </Button>
      </div>
    </div>
  );
}
