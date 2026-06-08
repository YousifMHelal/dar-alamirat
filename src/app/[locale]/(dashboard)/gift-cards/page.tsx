import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Gift, Wallet, BadgeCheck, TrendingDown, Plus } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listGiftCards, getGiftCardStats, type GiftCardStatus } from "@/lib/gift-cards/queries";
import { formatSar, formatNumber } from "@/lib/format";
import { CatalogHeader } from "@/components/catalog/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const MODULE_KEY = "giftCards";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "giftCards" });
  return { title: t("title") };
}

const STATUS_TONE = {
  ACTIVE: "success",
  REDEEMED: "info",
  EXPIRED: "neutral",
  DISABLED: "danger",
} as const;

export default async function GiftCardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "giftCards" });

  const statusOptions = ["ACTIVE", "REDEEMED", "EXPIRED", "DISABLED"] as const;
  const status = (statusOptions as readonly string[]).includes(sp.status ?? "")
    ? (sp.status as GiftCardStatus)
    : undefined;
  const search = sp.q?.trim() || undefined;
  const page = Number(sp.page) || 1;

  const [{ rows, total, pageCount }, stats] = await Promise.all([
    listGiftCards({ search, status, page }),
    getGiftCardStats(),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const hrefFor = (overrides: { q?: string; status?: string; page?: number }) => {
    const params = new URLSearchParams();
    const q = "q" in overrides ? overrides.q : search;
    const s = "status" in overrides ? overrides.status : status;
    const pg = "page" in overrides ? overrides.page : page;
    if (q) params.set("q", q);
    if (s) params.set("status", s);
    if (pg && pg > 1) params.set("page", String(pg));
    const qs = params.toString();
    return qs ? `/gift-cards?${qs}` : "/gift-cards";
  };

  const cards = [
    { icon: Gift, label: t("stats.total"), value: formatNumber(stats.total, locale), tone: "primary" as const },
    { icon: BadgeCheck, label: t("stats.active"), value: formatNumber(stats.active, locale), tone: "success" as const },
    { icon: Wallet, label: t("stats.outstanding"), value: formatSar(stats.outstandingBalance, locale), tone: "info" as const },
    { icon: TrendingDown, label: t("stats.redeemedThisMonth"), value: formatNumber(stats.redeemedThisMonth, locale), tone: "warning" as const },
  ];
  const toneClass: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success/12 text-success",
    info: "bg-accent/15 text-accent-foreground",
    warning: "bg-warning/20 text-warning-foreground",
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={Gift}
        action={
          <Link href="/gift-cards/new">
            <Button>
              <Plus />
              {t("issueCard")}
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5">
              <span className={`flex size-10 items-center justify-center rounded-xl ${toneClass[card.tone]}`}>
                <Icon className="size-4" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-xs font-medium">{card.label}</p>
                <p className="font-display text-foreground text-xl font-semibold tabular-nums">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/gift-cards" className="flex items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={search ?? ""}
            placeholder={t("filter.searchPlaceholder")}
            className="border-input bg-surface text-foreground h-9 w-56 rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
          />
          {status && <input type="hidden" name="status" value={status} />}
          <Button type="submit" variant="outline" size="sm">
            {t("filter.search")}
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip href={hrefFor({ status: undefined })} active={!status} label={t("filter.all")} />
          {statusOptions.map((s) => (
            <FilterChip key={s} href={hrefFor({ status: s })} active={status === s} label={t(`status.${s}`)} />
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-220 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.code")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.issuedTo")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.initialValue")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.balance")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.expiresAt")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} className="border-border hover:bg-muted/50 border-b transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/gift-cards/${g.id}`} className="text-foreground hover:text-primary font-mono font-medium tracking-wide transition-colors">
                        {g.code}
                      </Link>
                    </td>
                    <td className="text-foreground px-4 py-3">{g.issuedTo?.name ?? <span className="text-muted-foreground">{t("table.unassigned")}</span>}</td>
                    <td className="text-foreground px-4 py-3 tabular-nums">{formatSar(g.initialValue, locale)}</td>
                    <td className="text-foreground px-4 py-3 font-medium tabular-nums">{formatSar(g.remainingBalance, locale)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[g.status]}>{t(`status.${g.status}`)}</Badge>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">{g.expiresAt ? dateFmt.format(g.expiresAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-border flex items-center justify-between gap-4 border-t px-4 py-3">
            <p className="text-muted-foreground text-xs">{t("pagination.showing", { count: rows.length, total })}</p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">{t("pagination.page", { page, pageCount })}</span>
              <PagerLink href={hrefFor({ page: page - 1 })} disabled={page <= 1} label={t("pagination.prev")} />
              <PagerLink href={hrefFor({ page: page + 1 })} disabled={page >= pageCount} label={t("pagination.next")} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "bg-primary text-primary-foreground inline-flex h-8 items-center rounded-full px-4 text-xs font-medium transition-colors"
          : "border-border-strong bg-surface text-foreground hover:bg-muted inline-flex h-8 items-center rounded-full border px-4 text-xs transition-colors"
      }
    >
      {label}
    </Link>
  );
}

function PagerLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span className="border-border text-muted-foreground inline-flex h-8 cursor-not-allowed items-center rounded-lg border px-3 text-xs opacity-50">
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className="border-border-strong bg-surface text-foreground hover:bg-muted inline-flex h-8 items-center rounded-lg border px-3 text-xs transition-colors">
      {label}
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="bg-card shadow-soft border-border flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-16 text-center">
      <span className="bg-primary-soft text-primary flex size-14 items-center justify-center rounded-2xl">
        <Gift className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
