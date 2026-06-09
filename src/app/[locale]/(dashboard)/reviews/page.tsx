import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Star, MessageSquareText, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listReviews, getReviewStats } from "@/lib/reviews/queries";
import { formatNumber } from "@/lib/format";
import { CatalogHeader } from "@/components/catalog/page-header";
import { Badge } from "@/components/ui/badge";
import { ReviewSentimentButton } from "@/components/reviews/review-sentiment-button";

const MODULE_KEY = "reviews";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reviews" });
  return { title: t("title") };
}

const STATUS_TONE = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
} as const;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string; rating?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "reviews" });

  const status =
    sp.status === "PENDING" || sp.status === "APPROVED" || sp.status === "REJECTED" ? sp.status : undefined;
  const rating = ["1", "2", "3", "4", "5"].includes(sp.rating ?? "") ? Number(sp.rating) : undefined;
  const page = Number(sp.page) || 1;

  const [{ rows, total, pageCount }, stats] = await Promise.all([
    listReviews({ status, rating, page }),
    getReviewStats(),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (rating) params.set("rating", String(rating));
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/reviews?${qs}` : "/reviews";
  };
  const filterHref = (next: { status?: string; rating?: number }) => {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const r = next.rating ?? rating;
    if (s) params.set("status", s);
    if (r) params.set("rating", String(r));
    const qs = params.toString();
    return qs ? `/reviews?${qs}` : "/reviews";
  };

  const statusOptions = ["PENDING", "APPROVED", "REJECTED"] as const;

  const cards = [
    {
      icon: MessageSquareText,
      label: t("stats.total"),
      value: formatNumber(stats.total, locale),
      tone: "primary" as const,
    },
    {
      icon: Clock,
      label: t("stats.pending"),
      value: formatNumber(stats.pending, locale),
      tone: "warning" as const,
    },
    {
      icon: CheckCircle2,
      label: t("stats.approved"),
      value: formatNumber(stats.approved, locale),
      tone: "success" as const,
    },
    {
      icon: Star,
      label: t("stats.average"),
      value: formatNumber(parseFloat(stats.averageRating.toFixed(1)), locale),
      meta: t("stats.averageHint"),
      tone: "info" as const,
    },
  ];
  const toneClass: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning/20 text-warning-foreground",
    success: "bg-success/12 text-success",
    info: "bg-accent/15 text-accent-foreground",
  };

  const maxBreakdown = Math.max(1, ...Object.values(stats.ratingBreakdown));

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader title={t("title")} subtitle={t("subtitle")} icon={Star} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5"
            >
              <span className={`flex size-10 items-center justify-center rounded-xl ${toneClass[card.tone]}`}>
                <Icon className="size-4" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-xs font-medium">{card.label}</p>
                <p className="font-display text-foreground text-xl font-semibold tabular-nums">{card.value}</p>
                {"meta" in card && card.meta && (
                  <p className="text-muted-foreground text-xs">{card.meta}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <section className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5">
        <h3 className="font-display text-foreground text-sm font-semibold">{t("breakdown.title")}</h3>
        <div className="flex flex-col gap-2">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = stats.ratingBreakdown[star];
            const pct = (count / maxBreakdown) * 100;
            return (
              <Link
                key={star}
                href={filterHref({ rating: rating === star ? undefined : star })}
                className="group flex items-center gap-3 text-xs"
              >
                <span className="text-muted-foreground inline-flex w-10 items-center gap-1 tabular-nums">
                  {star}
                  <Star className="fill-warning text-warning size-3" />
                </span>
                <span className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                  <span
                    className={`block h-full rounded-full transition-colors ${rating === star ? "bg-primary" : "bg-warning/60 group-hover:bg-warning"}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="text-muted-foreground w-8 text-end tabular-nums">
                  {formatNumber(count, locale)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip href={filterHref({ status: undefined })} active={!status} label={t("filter.all")} />
        {statusOptions.map((s) => (
          <FilterChip
            key={s}
            href={filterHref({ status: status === s ? undefined : s })}
            active={status === s}
            label={t(`status.${s}`)}
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <article
              key={r.id}
              className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Stars rating={r.rating} />
                    {r.title && <h3 className="text-foreground text-sm font-semibold">{r.title}</h3>}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t("byOn", {
                      name: r.customer.name,
                      product: locale === "ar" ? r.product.nameAr : r.product.nameEn,
                      date: dateFmt.format(r.createdAt),
                    })}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[r.status]}>
                  {r.status === "APPROVED" && <CheckCircle2 className="size-3" />}
                  {r.status === "REJECTED" && <XCircle className="size-3" />}
                  {r.status === "PENDING" && <Clock className="size-3" />}
                  {t(`status.${r.status}`)}
                </Badge>
              </div>
              <p className="text-foreground text-sm leading-relaxed">{r.body}</p>
              <div className="flex items-center justify-between gap-3 pt-1">
                <ReviewSentimentButton
                  reviewId={r.id}
                  body={r.body}
                  title={r.title}
                  rating={r.rating}
                  sentiment={r.sentiment ?? null}
                  themes={r.themes}
                />
              </div>
            </article>
          ))}

          <div className="bg-card shadow-soft border-border flex items-center justify-between gap-4 rounded-2xl border px-4 py-3">
            <p className="text-muted-foreground text-xs">
              {t("pagination.showing", { count: rows.length, total })}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("pagination.page", { page, pageCount })}
              </span>
              <PagerLink href={pageHref(page - 1)} disabled={page <= 1} label={t("pagination.prev")} />
              <PagerLink href={pageHref(page + 1)} disabled={page >= pageCount} label={t("pagination.next")} />
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
    <Link
      href={href}
      className="border-border-strong bg-surface text-foreground hover:bg-muted inline-flex h-8 items-center rounded-lg border px-3 text-xs transition-colors"
    >
      {label}
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="bg-card shadow-soft border-border flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-16 text-center">
      <span className="bg-primary-soft text-primary flex size-14 items-center justify-center rounded-2xl">
        <Star className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
