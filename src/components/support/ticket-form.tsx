"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createTicket } from "@/lib/support/actions";

export function TicketForm() {
  const t = useTranslations("support");
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState({
    subject: "",
    body: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const res = await createTicket(form);
      if (res.ok) {
        router.push(`/support/${res.ticketId}`);
      } else {
        const msg = t(`form.errors.${res.error}` as never);
        setError(msg);
        toast(msg, "error");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
        <h2 className="font-display text-foreground mb-4 text-base font-semibold">{t("form.sectionDetails")}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="subject">{t("form.subject")}</Label>
            <Input id="subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder={t("form.subjectPlaceholder")} />
          </div>

          <div>
            <Label htmlFor="priority">{t("form.priority")}</Label>
            <select
              id="priority"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as typeof form.priority)}
              className="border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
            >
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                <option key={p} value={p}>
                  {t(`priority.${p}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="body">{t("form.body")}</Label>
            <textarea
              id="body"
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder={t("form.bodyPlaceholder")}
              rows={6}
              className="border-input bg-surface text-foreground w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-sm">
          <AlertTriangle className="size-4" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="animate-spin" /> : <Send />}
          {isSaving ? t("form.creating") : t("form.create")}
        </Button>
      </div>
    </div>
  );
}
