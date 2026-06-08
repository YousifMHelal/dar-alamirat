"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addTicketReply } from "@/lib/support/actions";

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("support");
  const router = useRouter();
  const { toast } = useToast();

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const onSend = () => {
    setError(null);
    startSave(async () => {
      const res = await addTicketReply({ ticketId, body });
      if (res.ok) {
        setBody("");
        toast(t("form.replySent"), "success");
        router.refresh();
      } else {
        const msg = t(`form.errors.${res.error}` as never);
        setError(msg);
        toast(msg, "error");
      }
    });
  };

  return (
    <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
      <h2 className="font-display text-foreground mb-3 text-sm font-semibold">{t("form.sectionReply")}</h2>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("form.replyPlaceholder")}
        rows={4}
        className="border-input bg-surface text-foreground w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
      />
      {error && (
        <p role="alert" className="text-destructive mt-2 inline-flex items-center gap-1.5 text-sm">
          <AlertTriangle className="size-4" />
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={onSend} disabled={isSaving || !body.trim()}>
          {isSaving ? <Loader2 className="animate-spin" /> : <Send />}
          {isSaving ? t("form.sending") : t("form.sendReply")}
        </Button>
      </div>
    </section>
  );
}
