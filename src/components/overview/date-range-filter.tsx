"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarRange, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Date-range control for the Overview dashboard. Like the orders toolbar,
 * it drives the page entirely through URL searchParams (`from`/`to` as
 * yyyy-mm-dd), so the server re-queries on change and the range is
 * shareable + reload-safe. Presets are convenience shortcuts that compute
 * the same two params.
 *
 * Bounds: the seeded order history runs 2026-01-01 → 2026-06-01, surfaced
 * here as min/max on the native date inputs.
 */
const DATA_MIN = "2026-01-01";
const DATA_MAX = "2026-06-01";

type Preset = "last30" | "last90" | "ytd" | "all";

function presetRange(preset: Preset): { from: string; to: string } {
  const max = new Date(DATA_MAX);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "last30": {
      const f = new Date(max);
      f.setDate(f.getDate() - 30);
      return { from: iso(f), to: DATA_MAX };
    }
    case "last90": {
      const f = new Date(max);
      f.setDate(f.getDate() - 90);
      return { from: iso(f), to: DATA_MAX };
    }
    case "ytd":
      return { from: "2026-01-01", to: DATA_MAX };
    case "all":
    default:
      return { from: DATA_MIN, to: DATA_MAX };
  }
}

export function DateRangeFilter({
  initialFrom,
  initialTo,
}: {
  initialFrom: string;
  initialTo: string;
}) {
  const t = useTranslations("overview.range");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const push = (nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams();
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  const applyPreset = (preset: Preset) => {
    const r = presetRange(preset);
    setFrom(r.from);
    setTo(r.to);
    push(r.from, r.to);
  };

  const inputClass =
    "border-input bg-surface text-foreground h-9 rounded-lg border px-2.5 text-sm shadow-soft tabular-nums focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";
  const presets: Preset[] = ["last30", "last90", "ytd", "all"];

  return (
    <div className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <CalendarRange className="size-4" />
          {t("label")}
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{t("from")}</span>
          <input
            type="date"
            value={from}
            min={DATA_MIN}
            max={to || DATA_MAX}
            onChange={(e) => {
              setFrom(e.target.value);
              push(e.target.value, to);
            }}
            className={inputClass}
            aria-label={t("from")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{t("to")}</span>
          <input
            type="date"
            value={to}
            min={from || DATA_MIN}
            max={DATA_MAX}
            onChange={(e) => {
              setTo(e.target.value);
              push(from, e.target.value);
            }}
            className={inputClass}
            aria-label={t("to")}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => applyPreset(p)}
            className="border-border-strong bg-surface text-foreground hover:bg-muted inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium transition-colors"
          >
            {t(`presets.${p}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
