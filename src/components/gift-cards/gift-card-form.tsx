"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { issueGiftCard } from "@/lib/gift-cards/actions";

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

export function GiftCardForm({ customers }: { customers: CustomerOption[] }) {
  const t = useTranslations("giftCards");
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState({
    code: "",
    initialValue: "",
    customerId: "",
    expiresAt: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const res = await issueGiftCard(form);
      if (res.ok) {
        router.push(`/gift-cards/${res.giftCardId}`);
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
          <div>
            <Label htmlFor="code">{t("form.code")}</Label>
            <Input id="code" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder={t("form.codePlaceholder")} className="font-mono tracking-wide" />
          </div>

          <div>
            <Label htmlFor="initialValue">{t("form.initialValue")}</Label>
            <Input id="initialValue" inputMode="decimal" value={form.initialValue} onChange={(e) => set("initialValue", e.target.value)} placeholder="200.00" />
          </div>

          <div>
            <Label htmlFor="customerId">{t("form.customer")}</Label>
            <select
              id="customerId"
              value={form.customerId}
              onChange={(e) => set("customerId", e.target.value)}
              className="border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">{t("form.customerNone")}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="expiresAt">{t("form.expiresAt")}</Label>
            <Input id="expiresAt" type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
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
          {isSaving ? t("form.issuing") : t("form.issue")}
        </Button>
      </div>
    </div>
  );
}
