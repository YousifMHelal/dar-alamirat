import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Bell, ShoppingCart, Boxes, Settings, Star, Users, BellOff } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listNotifications, getNotificationStats, type NotificationType } from "@/lib/notifications/queries";
import { formatNumber } from "@/lib/format";
import { CatalogHeader } from "@/components/catalog/page-header";
import { NotificationFeed, type NotificationFeedRow } from "@/components/notifications/notification-feed";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";

const MODULE_KEY = "notifications";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notifications" });
  return { title: t("title") };
}

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  ORDER: ShoppingCart,
  INVENTORY: Boxes,
  SYSTEM: Settings,
  REVIEW: Star,
  CUSTOMER: Users,
};

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ type?: string; read?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "notifications" });

  const types = ["ORDER", "INVENTORY", "SYSTEM", "REVIEW", "CUSTOMER"] as const;
  const type = (types as readonly string[]).includes(sp.type ?? "") ? (sp.type as NotificationType) : undefined;
  const readState = sp.read === "UNREAD" || sp.read === "READ" ? sp.read : undefined;
  const page = Number(sp.page) || 1;

  const [{ rows, total, pageCount }, stats] = await Promise.all([
    listNotifications({ type, readState, page }),
    getNotificationStats(),
  ]);

  const typeHref = (val?: string) => {
    const params = new URLSearchParams();
    if (val) params.set("type", val);
    if (readState) params.set("read", readState);
    const qs = params.toString();
    return qs ? `/notifications?${qs}` : "/notifications";
  };
  const readHref = (val?: string) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (val) params.set("read", val);
    const qs = params.toString();
    return qs ? `/notifications?${qs}` : "/notifications";
  };
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (readState) params.set("read", readState);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/notifications?${qs}` : "/notifications";
  };

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const cards = [
    { icon: Bell, label: t("stats.unread"), value: formatNumber(stats.unread, locale), tone: "primary" as const },
    ...types.map((tp) => ({
      icon: TYPE_ICON[tp],
      label: t(`stats.byType.${tp}`),
      value: formatNumber(stats.byType[tp], locale),
      tone: "info" as const,
    })),
  ];
  const toneClass: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    info: "bg-accent/15 text-accent-foreground",
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={Bell}
        action={<MarkAllReadButton />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
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
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip href={typeHref()} active={!type} label={t("filter.all")} />
          {types.map((tp) => (
            <FilterChip key={tp} href={typeHref(tp)} active={type === tp} label={t(`type.${tp}`)} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <FilterChip href={readHref()} active={!readState} label={t("filter.allReadStates")} />
          <FilterChip href={readHref("UNREAD")} active={readState === "UNREAD"} label={t("filter.unread")} />
          <FilterChip href={readHref("READ")} active={readState === "READ"} label={t("filter.read")} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <NotificationFeed
          rows={rows.map((r): NotificationFeedRow => ({ ...r, formattedDate: dateFmt.format(r.createdAt) }))}
        />
      )}

      {rows.length > 0 && (
        <div className="bg-card shadow-soft border-border flex items-center justify-between gap-4 rounded-2xl border px-4 py-3">
          <p className="text-muted-foreground text-xs">{t("pagination.showing", { count: rows.length, total })}</p>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs tabular-nums">{t("pagination.page", { page, pageCount })}</span>
            <PagerLink href={pageHref(page - 1)} disabled={page <= 1} label={t("pagination.prev")} />
            <PagerLink href={pageHref(page + 1)} disabled={page >= pageCount} label={t("pagination.next")} />
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
        <BellOff className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
