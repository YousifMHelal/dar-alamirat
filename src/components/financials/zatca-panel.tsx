"use client";

import { useState, useTransition } from "react";
import {
  FileText,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { generateInvoiceForOrder } from "@/lib/financials/invoice";

interface Props {
  /** Pre-loaded order list: id + orderNumber for the selector. */
  orders: Array<{ id: string; orderNumber: string }>;
}

export function ZatcaPanel({ orders }: Props) {
  const t = useTranslations("financials.zatca");
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const [result, setResult] = useState<{
    xml?: string;
    qrCode?: string;
    submissionStatus?: string;
    warnings?: string[];
    errors?: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showXml, setShowXml] = useState(false);
  const { toast } = useToast();

  function handleGenerate() {
    if (!selectedOrderId) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await generateInvoiceForOrder(selectedOrderId);
      if (res.ok) {
        setResult(res);
        toast(t("generate") + " ✓", "success");
      } else {
        setError(res.error);
        toast(res.error, "error");
      }
    });
  }

  const statusTone = (s?: string) => {
    if (!s) return "neutral" as const;
    if (s === "REPORTED" || s === "CLEARED") return "success" as const;
    if (s === "WARNING") return "warning" as const;
    if (s === "ERROR") return "danger" as const;
    return "neutral" as const;
  };

  return (
    <section className="bg-card shadow-soft border-border flex flex-col gap-6 rounded-2xl border p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-foreground text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {/* Order selector + generate */}
      <div className="flex items-center gap-3">
        <select
          value={selectedOrderId}
          onChange={(e) => setSelectedOrderId(e.target.value)}
          className="bg-surface border-border text-foreground focus:ring-primary h-10 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        >
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.orderNumber}
            </option>
          ))}
        </select>
        <Button
          onClick={handleGenerate}
          disabled={isPending || !selectedOrderId}
          size="sm"
        >
          <FileText />
          {isPending ? t("generating") : t("generate")}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="border-destructive/30 bg-destructive/8 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm text-red-700">
          <XCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-4">
          {/* Submission status badge */}
          {result.submissionStatus && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                {t("submissionStatus")}:
              </span>
              <Badge tone={statusTone(result.submissionStatus)}>
                {result.submissionStatus}
              </Badge>
            </div>
          )}

          {!result.submissionStatus && (
            <div className="border-warning/30 bg-warning/8 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm text-amber-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{t("noCsidNote")}</p>
            </div>
          )}

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <ul className="flex flex-col gap-1">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-warning-foreground flex items-center gap-2 text-xs">
                  <AlertTriangle className="size-3 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}

          {/* QR code display */}
          {result.qrCode && (
            <div className="border-border flex flex-col items-center gap-3 rounded-xl border p-4">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                <QrCode className="size-4" />
                {t("qrLabel")}
              </p>
              {/* Render as an <img> from base64 QR — in production embed an
                  actual QR renderer; here we surface the raw TLV value */}
              <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs break-all max-w-full">
                {result.qrCode.slice(0, 60)}…
              </div>
              <p className="text-muted-foreground text-xs">{t("qrHint")}</p>
            </div>
          )}

          {/* XML toggle */}
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setShowXml(!showXml)}
            >
              <CheckCircle2 />
              {showXml ? t("hideXml") : t("showXml")}
            </Button>
            {showXml && result.xml && (
              <pre className="bg-muted border-border max-h-96 overflow-auto rounded-xl border p-4 font-mono text-xs text-gray-700">
                {result.xml}
              </pre>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
