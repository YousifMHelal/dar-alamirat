"use client";

import { useState, useTransition } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { runReconciliation } from "@/lib/financials/reconciliation";
import type { ReconciliationSummary, ReconciliationLine } from "@/lib/financials/reconciliation";

interface Props {
  initial: ReconciliationSummary | null;
}

export function ReconciliationPanel({ initial, locale }: Props & { locale?: string }) {
  const t = useTranslations("financials.reconciliation");
  const { toast } = useToast();
  const [summary, setSummary] = useState<ReconciliationSummary | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    setError(null);
    startTransition(async () => {
      const res = await runReconciliation();
      if (res.ok) {
        setSummary(res.summary);
        toast(t("matched") + ": " + res.summary.matched, "success");
      } else {
        setError(res.error);
        toast(res.error, "error");
      }
    });
  }

  return (
    <section className="bg-card shadow-soft border-border flex flex-col gap-6 rounded-2xl border p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-foreground text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRun}
          disabled={isPending}
        >
          <RefreshCw className={isPending ? "animate-spin" : ""} />
          {isPending ? t("running") : t("run")}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-destructive/30 bg-destructive/8 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm text-red-700">
          <XCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Integration errors (partial success) */}
      {summary?.errors && summary.errors.length > 0 && (
        <div className="border-warning/30 bg-warning/8 flex flex-col gap-1 rounded-xl border px-4 py-3">
          {summary.errors.map((e, i) => (
            <p key={i} className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="size-4 shrink-0" />
              {e}
            </p>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCell label={t("tabbyLines")} value={summary.tabbyLines} />
            <StatCell label={t("tamaraLines")} value={summary.tamaraLines} />
            <StatCell label={t("matched")} value={summary.matched} success />
            <StatCell label={t("unmatched")} value={summary.unmatched} warn={summary.unmatched > 0} />
          </div>

          <div className="border-border grid grid-cols-2 gap-3 border-t pt-4">
            <div>
              <p className="text-muted-foreground text-xs font-medium">{t("totalFees")}</p>
              <p className="font-display text-foreground tabular-nums text-base font-semibold">
                SAR {summary.totalFees}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">{t("totalNet")}</p>
              <p className="font-display text-foreground tabular-nums text-base font-semibold">
                SAR {summary.totalNet}
              </p>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            {t("lastRun")}:{" "}
            {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(summary.runAt))}
          </p>

          {/* Lines table */}
          {summary.lines.length > 0 && (
            <ReconciliationTable lines={summary.lines} />
          )}
        </>
      )}

      {!summary && !isPending && (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
          <Clock className="size-8 opacity-40" />
          <p>{t("noData")}</p>
        </div>
      )}
    </section>
  );
}

function StatCell({
  label,
  value,
  success,
  warn,
}: {
  label: string;
  value: number;
  success?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="bg-muted/50 border-border flex flex-col gap-1 rounded-xl border px-4 py-3">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p
        className={`font-display tabular-nums text-lg font-semibold ${
          success ? "text-success" : warn ? "text-warning-foreground" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ReconciliationTable({ lines }: { lines: ReconciliationLine[] }) {
  const t = useTranslations("financials.reconciliation");

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <div className="scrollbar-subtle overflow-x-auto">
      <table className="w-full min-w-180 text-sm">
        <thead className="bg-muted/50 border-border border-b">
          <tr>
            <th className="text-muted-foreground px-4 py-3 text-start text-xs font-medium">
              {t("order")}
            </th>
            <th className="text-muted-foreground px-4 py-3 text-start text-xs font-medium">
              {t("gateway")}
            </th>
            <th className="text-muted-foreground px-4 py-3 text-end text-xs font-medium">
              {t("gross")}
            </th>
            <th className="text-muted-foreground px-4 py-3 text-end text-xs font-medium">
              {t("fee")}
            </th>
            <th className="text-muted-foreground px-4 py-3 text-end text-xs font-medium">
              {t("net")}
            </th>
            <th className="text-muted-foreground px-4 py-3 text-start text-xs font-medium">
              {t("status")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {lines.map((line) => (
            <tr key={line.paymentId} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">{line.orderNumber}</td>
              <td className="px-4 py-3">
                <Badge tone={line.gateway === "TABBY" ? "primary" : "info"}>
                  {line.gateway}
                </Badge>
              </td>
              <td className="text-foreground px-4 py-3 text-end tabular-nums">
                {line.amountMismatch ? (
                  <span className="text-destructive font-semibold">
                    {line.amount} ⚠
                  </span>
                ) : (
                  line.amount
                )}
              </td>
              <td className="text-muted-foreground px-4 py-3 text-end tabular-nums">
                {line.gatewayFee}
              </td>
              <td className="text-foreground px-4 py-3 text-end tabular-nums font-medium">
                {line.netAmount}
              </td>
              <td className="px-4 py-3">
                {line.status === "RECONCILED" ? (
                  <span className="text-success flex items-center gap-1 text-xs font-medium">
                    <CheckCircle2 className="size-3" /> {t("statusReconciled")}
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Clock className="size-3" /> {t("statusPending")}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
