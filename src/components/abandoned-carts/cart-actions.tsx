"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, BellRing, CheckCircle2, Link2, Sparkles, Send, Copy, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { sendCartReminder, markCartRecovered, sendCartWhatsAppMessage } from "@/lib/abandoned-carts/actions";
import { generateCartRecoveryMessage } from "@/lib/ai/generate-cart-recovery";

interface CartItem {
  name: string;
  quantity: number;
  price: string;
}

export function CartActions({
  id,
  status,
  recoveryLink,
  customerName,
  customerPhone,
  items,
  subtotal,
}: {
  id: string;
  status: "ACTIVE" | "RECOVERED" | "EXPIRED";
  recoveryLink: string;
  customerName: string;
  customerPhone: string | null;
  items: CartItem[];
  subtotal: string;
}) {
  const t = useTranslations("abandonedCarts");
  const router = useRouter();
  const { toast } = useToast();
  const [isReminding, startReminder] = useTransition();
  const [isRecovering, startRecover] = useTransition();
  const [isGenerating, startGenerate] = useTransition();
  const [isSending, startSend] = useTransition();
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);

  const onRemind = () => {
    startReminder(async () => {
      const res = await sendCartReminder(id);
      if (res.ok) {
        toast(t("actions.reminderSent"), "success");
        router.refresh();
      } else {
        toast(t(`actions.errors.${res.error}` as never), "error");
      }
    });
  };

  const onRecover = () => {
    startRecover(async () => {
      const res = await markCartRecovered(id);
      if (res.ok) {
        toast(t("actions.markedRecovered"), "success");
        router.refresh();
      } else {
        toast(t(`actions.errors.${res.error}` as never), "error");
      }
    });
  };

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(recoveryLink);
      toast(t("actions.linkCopied"), "success");
    } catch {
      toast(t("actions.errors.unknown"), "error");
    }
  };

  const onGenerate = () => {
    startGenerate(async () => {
      const res = await generateCartRecoveryMessage({
        customerName,
        items,
        subtotal,
        recoveryLink,
      });
      if (res.ok) {
        setGeneratedMessage(res.message);
      } else {
        toast(t("actions.ai.error"), "error");
      }
    });
  };

  const onCopyMessage = async () => {
    if (!generatedMessage) return;
    try {
      await navigator.clipboard.writeText(generatedMessage);
      toast(t("actions.ai.copied"), "success");
    } catch {
      toast(t("actions.errors.unknown"), "error");
    }
  };

  const onSendWhatsApp = () => {
    if (!generatedMessage) return;
    startSend(async () => {
      const res = await sendCartWhatsAppMessage(id, generatedMessage);
      if (res.ok) {
        toast(res.sent ? t("actions.ai.whatsappSent") : t("actions.ai.copied"), "success");
        setGeneratedMessage(null);
        router.refresh();
      } else {
        toast(t("actions.errors.unknown"), "error");
      }
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCopyLink} title={t("actions.copyLink")}>
          <Link2 />
        </Button>
        {status === "ACTIVE" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerate}
              disabled={isGenerating}
              title={t("actions.ai.generate")}
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {t("actions.ai.generate")}
            </Button>
            <Button variant="outline" size="sm" onClick={onRemind} disabled={isReminding}>
              {isReminding ? <Loader2 className="animate-spin" /> : <BellRing />}
              {t("actions.sendReminder")}
            </Button>
            <Button size="sm" onClick={onRecover} disabled={isRecovering}>
              {isRecovering ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {t("actions.markRecovered")}
            </Button>
          </>
        )}
      </div>

      {/* ── AI message preview modal ──────────────────────────────── */}
      {generatedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border-border shadow-soft flex w-full max-w-lg flex-col gap-4 rounded-2xl border p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-foreground text-base font-semibold">
                  {t("actions.ai.previewTitle")}
                </h3>
                <p className="text-muted-foreground mt-0.5 text-xs">{customerName}</p>
              </div>
              <button
                onClick={() => setGeneratedMessage(null)}
                className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div
              dir="rtl"
              className="bg-surface-muted border-border max-h-64 overflow-y-auto rounded-xl border p-4 text-sm leading-relaxed whitespace-pre-wrap"
            >
              {generatedMessage}
            </div>

            <textarea
              dir="rtl"
              rows={6}
              value={generatedMessage}
              onChange={(e) => setGeneratedMessage(e.target.value)}
              className="border-input bg-surface text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
            />

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCopyMessage}>
                <Copy />
                {t("actions.ai.copy")}
              </Button>
              {customerPhone && (
                <Button size="sm" onClick={onSendWhatsApp} disabled={isSending}>
                  {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                  {isSending ? t("actions.ai.sending") : t("actions.ai.send")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
