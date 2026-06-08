"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, TicketPlus, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createCoupon, updateCoupon, deleteCoupon } from "@/lib/coupons/actions";
import type { CouponDetail } from "@/lib/coupons/queries";

const ERROR_KEYS = [
  "codeRequired",
  "codeInvalid",
  "codeTaken",
  "valueInvalid",
  "percentageOutOfRange",
  "usageLimitInvalid",
  "startsAtRequired",
  "dateInvalid",
  "endBeforeStart",
  "couponInUse",
  "notFound",
  "unknown",
] as const;

type ErrorKey = (typeof ERROR_KEYS)[number];

function translateError(t: ReturnType<typeof useTranslations<"coupons">>, error: string): string {
  const key: ErrorKey = (ERROR_KEYS as readonly string[]).includes(error) ? (error as ErrorKey) : "unknown";
  return t(`form.errors.${key}` as const);
}

const selectClass =
  "border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

export function CouponForm({ coupon }: { coupon?: CouponDetail }) {
  const t = useTranslations("coupons");
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = Boolean(coupon);

  const [form, setForm] = useState({
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    type: coupon?.type ?? "PERCENTAGE",
    value: coupon?.value ?? "",
    minOrder: coupon?.minOrder ?? "",
    usageLimit: coupon?.usageLimit ?? "",
    startsAt: coupon?.startsAt ?? "",
    endsAt: coupon?.endsAt ?? "",
    status: coupon?.status ?? "ACTIVE",
  });

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSave = () => {
    setError(null);
    setSaved(false);
    const payload = { ...form };

    startSave(async () => {
      const res = isEdit && coupon ? await updateCoupon({ ...payload, id: coupon.id }) : await createCoupon(payload);

      if (res.ok) {
        if (isEdit) {
          setSaved(true);
          toast(t("form.saved"), "success");
          router.refresh();
        } else {
          router.push("/coupons");
        }
      } else {
        const msg = translateError(t, res.error);
        setError(msg);
        toast(msg, "error");
      }
    });
  };

  const onDelete = () => {
    if (!coupon) return;
    if (!window.confirm(t("form.confirmDelete"))) return;
    setError(null);
    startDelete(async () => {
      const res = await deleteCoupon(coupon.id);
      if (res.ok) router.push("/coupons");
      else setError(translateError(t, res.error));
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
        <h2 className="font-display text-foreground mb-4 text-base font-semibold">{t("form.sectionDetails")}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="code">{t("form.code")}</Label>
            <Input
              id="code"
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              dir="ltr"
              placeholder="e.g. SUMMER25"
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor="status">{t("form.status")}</Label>
            <select
              id="status"
              value={form.status}
              onChange={(e) => set("status", e.target.value as typeof form.status)}
              className={selectClass}
            >
              {(["ACTIVE", "SCHEDULED", "EXPIRED", "DISABLED"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="description">{t("form.description")}</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={t("form.descriptionPlaceholder")}
            />
          </div>

          <div>
            <Label htmlFor="type">{t("form.type")}</Label>
            <select
              id="type"
              value={form.type}
              onChange={(e) => set("type", e.target.value as typeof form.type)}
              className={selectClass}
            >
              <option value="PERCENTAGE">{t("form.typePercentage")}</option>
              <option value="FIXED_AMOUNT">{t("form.typeFixedAmount")}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="value">{form.type === "PERCENTAGE" ? t("form.valuePercentage") : t("form.valueFixed")}</Label>
            <Input
              id="value"
              type="text"
              inputMode="decimal"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              dir="ltr"
              className="text-end tabular-nums"
            />
          </div>

          <div>
            <Label htmlFor="minOrder">{t("form.minOrder")}</Label>
            <Input
              id="minOrder"
              type="text"
              inputMode="decimal"
              value={form.minOrder}
              onChange={(e) => set("minOrder", e.target.value)}
              dir="ltr"
              placeholder={t("form.minOrderPlaceholder")}
              className="text-end tabular-nums"
            />
          </div>
          <div>
            <Label htmlFor="usageLimit">{t("form.usageLimit")}</Label>
            <Input
              id="usageLimit"
              type="text"
              inputMode="numeric"
              value={form.usageLimit}
              onChange={(e) => set("usageLimit", e.target.value)}
              dir="ltr"
              placeholder={t("form.usageLimitPlaceholder")}
              className="text-end tabular-nums"
            />
          </div>

          <div>
            <Label htmlFor="startsAt">{t("form.startsAt")}</Label>
            <Input
              id="startsAt"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <Label htmlFor="endsAt">{t("form.endsAt")}</Label>
            <Input
              id="endsAt"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
              dir="ltr"
            />
            <p className="text-muted-foreground mt-1 text-xs">{t("form.endsAtHint")}</p>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-sm">
          <AlertTriangle className="size-4" />
          {error}
        </p>
      )}
      {saved && (
        <p className="text-success inline-flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="size-4" />
          {t("form.saved")}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="animate-spin" /> : isEdit ? <Save /> : <TicketPlus />}
          {isSaving ? (isEdit ? t("form.saving") : t("form.creating")) : isEdit ? t("form.save") : t("form.create")}
        </Button>
        {isEdit && (
          <Button
            variant="ghost"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-destructive hover:bg-destructive/10"
          >
            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {isDeleting ? t("form.deleting") : t("form.delete")}
          </Button>
        )}
      </div>
    </div>
  );
}
