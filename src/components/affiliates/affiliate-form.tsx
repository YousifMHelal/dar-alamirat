"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Megaphone, Percent, Trash2, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import {
  createAffiliate,
  updateAffiliate,
  deleteAffiliate,
} from "@/lib/affiliates/actions";
import type { AffiliateDetail } from "@/lib/affiliates/queries";

type Channel = "SNAPCHAT" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "OTHER";
type Status = "ACTIVE" | "PAUSED" | "ENDED";

const CHANNELS: Channel[] = ["SNAPCHAT", "INSTAGRAM", "TIKTOK", "YOUTUBE", "OTHER"];
const STATUSES: Status[] = ["ACTIVE", "PAUSED", "ENDED"];

export function AffiliateForm({
  locale,
  detail,
}: {
  locale: string;
  detail?: AffiliateDetail;
}) {
  const t = useTranslations("affiliates");
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!detail;

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(detail?.name ?? "");
  const [handle, setHandle] = useState(detail?.handle ?? "");
  const [channel, setChannel] = useState<Channel>(detail?.channel ?? "SNAPCHAT");
  const [code, setCode] = useState(detail?.code ?? "");
  const [email, setEmail] = useState(detail?.email ?? "");
  const [phone, setPhone] = useState(detail?.phone ?? "");
  const [commissionRate, setCommissionRate] = useState(detail?.commissionRate ?? "");
  const [status, setStatus] = useState<Status>(detail?.status ?? "ACTIVE");
  const [contractTerms, setContractTerms] = useState(detail?.contractTerms ?? "");

  function submit() {
    setError(null);
    const payload = {
      name,
      handle,
      channel,
      code,
      email,
      phone,
      commissionRate,
      status,
      contractTerms,
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateAffiliate({ ...payload, id: detail!.id })
        : await createAffiliate(payload);

      if (result.ok) {
        if (isEdit) {
          toast(t("form.saved"), "success");
        } else {
          router.push(`/affiliates/${result.affiliateId}`);
        }
      } else {
        setError(t(`form.errors.${result.error}` as never) ?? result.error);
      }
    });
  }

  function handleDelete() {
    if (!detail) return;
    startTransition(async () => {
      const result = await deleteAffiliate(detail.id);
      if (result.ok) {
        router.push("/affiliates");
      } else {
        setError(t(`form.errors.${result.error}` as never) ?? result.error);
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="bg-card border-border shadow-soft rounded-2xl border p-6">
        <h2 className="font-display text-foreground mb-5 flex items-center gap-2 text-base font-semibold">
          <Sparkles className="text-primary size-4" />
          {t("form.sectionDetails")}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">{t("form.name")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="handle">{t("form.handle")}</Label>
            <Input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={t("form.handlePlaceholder")}
            />
          </div>
          <div>
            <Label htmlFor="channel">{t("form.channel")}</Label>
            <select
              id="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {t(`channel.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="status">{t("form.status")}</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="code">{t("form.code")}</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("form.codePlaceholder")}
              className="font-mono uppercase"
            />
            <p className="text-muted-foreground mt-1 text-xs">{t("form.codeHint")}</p>
          </div>
          <div>
            <Label htmlFor="commissionRate">{t("form.commissionRate")}</Label>
            <div className="relative">
              <div className="text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2">
                <Percent className="size-3.5" />
              </div>
              <Input
                id="commissionRate"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                inputMode="decimal"
                className="ps-9"
                placeholder="10"
              />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">{t("form.commissionRateHint")}</p>
          </div>
          <div>
            <Label htmlFor="email">{t("form.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="phone">{t("form.phone")}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="contractTerms">{t("form.contractTerms")}</Label>
          <textarea
            id="contractTerms"
            value={contractTerms}
            onChange={(e) => setContractTerms(e.target.value)}
            rows={4}
            placeholder={t("form.contractTermsPlaceholder")}
            className="border-input bg-surface text-foreground w-full rounded-lg border px-3 py-2 text-sm"
            dir={locale === "ar" ? "rtl" : "ltr"}
          />
        </div>
      </section>

      {error ? <FieldError>{error}</FieldError> : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          {isEdit ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-destructive text-sm">{t("form.confirmDelete")}</span>
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPending ? t("form.deleting") : t("form.delete")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isPending}
                >
                  {t("form.cancel")}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={isPending}>
                <Trash2 className="size-4" />
                {t("form.delete")}
              </Button>
            )
          ) : null}
        </div>

        <Button onClick={submit} disabled={isPending}>
          <Megaphone className="size-4" />
          {isPending
            ? isEdit
              ? t("form.saving")
              : t("form.creating")
            : isEdit
              ? t("form.save")
              : t("form.create")}
        </Button>
      </div>
    </div>
  );
}
