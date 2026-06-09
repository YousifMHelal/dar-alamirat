"use client";

import { useState, useTransition } from "react";
import { FileText, QrCode, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { generateInvoiceForOrder } from "@/lib/financials/invoice";
import type { OrderZatcaStatus } from "@/lib/orders/queries";

interface Props {
  orderId: string;
  initialStatus: OrderZatcaStatus;
}

type ZatcaResult = {
  qrCode: string | null;
  xml: string | null;
  submissionStatus: string | null;
};

function statusTone(s: string | null | undefined): "success" | "warning" | "danger" | "neutral" {
  if (!s) return "neutral";
  if (s === "REPORTED" || s === "CLEARED") return "success";
  if (s === "WARNING") return "warning";
  if (s === "ERROR") return "danger";
  return "neutral";
}

export function ZatcaOrderSection({ orderId, initialStatus }: Props) {
  const t = useTranslations("orders.detail.zatca");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ZatcaResult | null>(
    initialStatus
      ? { qrCode: initialStatus.qrCode, xml: initialStatus.xml, submissionStatus: initialStatus.submissionStatus }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [showXml, setShowXml] = useState(false);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateInvoiceForOrder(orderId);
      if (res.ok) {
        setResult({ qrCode: res.qrCode, xml: res.xml, submissionStatus: res.submissionStatus ?? null });
        toast(t("issued"), "success");
      } else {
        setError(res.error);
        toast(res.error, "error");
      }
    });
  }

  const hasResult = result !== null;
  const status = result?.submissionStatus ?? null;

  return (
    <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-foreground text-sm font-semibold">{t("title")}</h2>
        {hasResult && status && (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Badge tone={statusTone(status)}>{t(`status.${status}` as any)}</Badge>
        )}
        {hasResult && !status && (
          <Badge tone="warning">{t("status.LOCAL")}</Badge>
        )}
      </div>

      {/* Issue / Re-issue button */}
      <Button
        size="sm"
        variant={hasResult ? "outline" : "primary"}
        onClick={handleGenerate}
        disabled={isPending}
        className="w-full"
      >
        <FileText />
        {isPending ? t("issuing") : hasResult ? t("reissue") : t("issue")}
      </Button>

      {/* Error */}
      {error && (
        <div className="border-destructive/30 bg-destructive/8 mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm text-red-700">
          <XCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* QR code */}
      {hasResult && result.qrCode && (
        <div className="border-border mt-4 flex flex-col items-center gap-2 rounded-xl border p-4">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <QrCode className="size-4" />
            {t("qrLabel")}
          </p>
          <div className="bg-muted/50 w-full rounded-lg p-3 font-mono text-xs break-all">
            {result.qrCode.slice(0, 72)}…
          </div>
          <p className="text-muted-foreground text-xs">{t("qrHint")}</p>
        </div>
      )}

      {/* No CSID notice */}
      {hasResult && !status && (
        <div className="border-warning/30 bg-warning/8 mt-3 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{t("noCsidNote")}</p>
        </div>
      )}

      {/* XML toggle */}
      {hasResult && result.xml && (
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowXml(!showXml)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            {showXml ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {showXml ? t("hideXml") : t("showXml")}
          </button>
          {showXml && (
            <pre className="bg-muted border-border max-h-64 overflow-auto rounded-xl border p-3 font-mono text-xs text-gray-700">
              {result.xml}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
