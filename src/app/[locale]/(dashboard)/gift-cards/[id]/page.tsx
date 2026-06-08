import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Gift, User, ArrowDownCircle, ArrowUpCircle, RotateCcw } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { getGiftCardDetail } from "@/lib/gift-cards/queries";
import { formatSar } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { DisableCardButton } from "@/components/gift-cards/disable-card-button";

const MODULE_KEY = "giftCards";

const STATUS_TONE = {
  ACTIVE: "success",
  REDEEMED: "info",
  EXPIRED: "neutral",
  DISABLED: "danger",
} as const;

const TX_ICON = {
  ISSUE: ArrowUpCircle,
  REDEMPTION: ArrowDownCircle,
  REFUND: RotateCcw,
} as const;

const TX_TONE: Record<string, string> = {
  ISSUE: "text-success",
  REDEMPTION: "text-destructive",
  REFUND: "text-accent-foreground",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const [t, card] = await Promise.all([
    getTranslations({ locale, namespace: "giftCards" }),
    getGiftCardDetail(id),
  ]);
  return { title: card ? `${t("form.detailTitle")} — ${card.code}` : t("title") };
}

export default async function GiftCardDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const t = await getTranslations({ locale, namespace: "giftCards" });
  const card = await getGiftCardDetail(id);
  if (!card) notFound();

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <Link href="/gift-cards" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("backToGiftCards")}
      </Link>

      <header className="border-border flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-xl">
            <Gift className="size-5" />
          </span>
          <h1 className="font-display text-foreground font-mono text-2xl font-semibold tracking-wide sm:text-3xl">{card.code}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[card.status]}>{t(`status.${card.status}`)}</Badge>
            {card.issuedTo && (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <User className="size-3.5" />
                {card.issuedTo.name}
              </span>
            )}
            <span className="text-muted-foreground text-xs tabular-nums">{t("form.issuedOn", { date: dayFmt.format(card.createdAt) })}</span>
          </div>
        </div>
        {card.status === "ACTIVE" && <DisableCardButton giftCardId={card.id} />}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
            <h2 className="font-display text-foreground mb-3 text-sm font-semibold">{t("form.sectionTransactions")}</h2>
            {card.transactions.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("form.noTransactions")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {card.transactions.map((tx) => {
                  const Icon = TX_ICON[tx.type];
                  return (
                    <li key={tx.id} className="border-border flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <span className={`bg-muted flex size-9 items-center justify-center rounded-lg ${TX_TONE[tx.type]}`}>
                          <Icon className="size-4" />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-foreground text-sm font-medium">{t(`transactionType.${tx.type}`)}</span>
                          <span className="text-muted-foreground text-xs tabular-nums">{dateFmt.format(tx.createdAt)}</span>
                          {tx.order && (
                            <span className="text-muted-foreground text-xs">{t("form.relatedOrder", { number: tx.order.orderNumber })}</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums ${TX_TONE[tx.type]}`}>
                        {tx.type === "REDEMPTION" ? "-" : "+"}
                        {formatSar(tx.amount, locale)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5">
            <h2 className="font-display text-foreground text-sm font-semibold">{t("form.sectionBalance")}</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{t("table.initialValue")}</dt>
                <dd className="text-foreground font-medium tabular-nums">{formatSar(card.initialValue, locale)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{t("table.balance")}</dt>
                <dd className="text-foreground font-semibold tabular-nums">{formatSar(card.remainingBalance, locale)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{t("table.expiresAt")}</dt>
                <dd className="text-foreground font-medium">{card.expiresAt ? dayFmt.format(card.expiresAt) : "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5">
            <h2 className="font-display text-foreground text-sm font-semibold">{t("form.sectionInfo")}</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{t("table.issuedTo")}</dt>
                <dd className="text-foreground font-medium">{card.issuedTo?.name ?? t("table.unassigned")}</dd>
              </div>
              {card.issuedTo?.phone && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{t("form.customerPhone")}</dt>
                  <dd className="text-foreground font-medium" dir="ltr">
                    {card.issuedTo.phone}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
