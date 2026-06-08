import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LifeBuoy, Inbox, Loader2, CheckCircle2, Clock, Plus, MessagesSquare } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listTickets, getTicketStats, type TicketStatus, type TicketPriority } from "@/lib/support/queries";
import { formatNumber } from "@/lib/format";
import { CatalogHeader } from "@/components/catalog/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const MODULE_KEY = "support";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "support" });
  return { title: t("title") };
}

const STATUS_TONE = {
  OPEN: "info",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
} as const;

const PRIORITY_TONE = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
} as const;

export default async function SupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string; priority?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "support" });

  const statusOptions = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
  const priorityOptions = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
  const status = (statusOptions as readonly string[]).includes(sp.status ?? "") ? (sp.status as TicketStatus) : undefined;
  const priority = (priorityOptions as readonly string[]).includes(sp.priority ?? "")
    ? (sp.priority as TicketPriority)
    : undefined;
  const page = Number(sp.page) || 1;

  const [{ rows, total, pageCount }, stats] = await Promise.all([
    listTickets({ status, priority, page }),
    getTicketStats(),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const hrefFor = (overrides: { status?: string; priority?: string; page?: number }) => {
    const params = new URLSearchParams();
    const s = "status" in overrides ? overrides.status : status;
    const p = "priority" in overrides ? overrides.priority : priority;
    const pg = "page" in overrides ? overrides.page : page;
    if (s) params.set("status", s);
    if (p) params.set("priority", p);
    if (pg && pg > 1) params.set("page", String(pg));
    const qs = params.toString();
    return qs ? `/support?${qs}` : "/support";
  };

  const cards = [
    { icon: Inbox, label: t("stats.open"), value: formatNumber(stats.open, locale), tone: "info" as const },
    { icon: Loader2, label: t("stats.inProgress"), value: formatNumber(stats.inProgress, locale), tone: "warning" as const },
    { icon: CheckCircle2, label: t("stats.resolved"), value: formatNumber(stats.resolved, locale), tone: "success" as const },
    {
      icon: Clock,
      label: t("stats.avgResponse"),
      value: stats.avgResponseHours != null ? t("stats.avgResponseValue", { hours: formatNumber(stats.avgResponseHours, locale) }) : "—",
      tone: "primary" as const,
    },
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
        icon={LifeBuoy}
        action={
          <Link href="/support/new">
            <Button>
              <Plus />
              {t("newTicket")}
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
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip href={hrefFor({ status: undefined })} active={!status} label={t("filter.all")} />
          {statusOptions.map((s) => (
            <FilterChip key={s} href={hrefFor({ status: s })} active={status === s} label={t(`status.${s}`)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip href={hrefFor({ priority: undefined })} active={!priority} label={t("filter.allPriorities")} />
          {priorityOptions.map((p) => (
            <FilterChip key={p} href={hrefFor({ priority: p })} active={priority === p} label={t(`priority.${p}`)} />
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
                  <th className="px-4 py-3 text-start font-semibold">{t("table.subject")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.customer")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.priority")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.assignedTo")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.created")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tk) => (
                  <tr key={tk.id} className="border-border hover:bg-muted/50 border-b transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/support/${tk.id}`} className="text-foreground hover:text-primary font-medium transition-colors">
                        {tk.subject}
                      </Link>
                      {tk.replyCount > 0 && (
                        <div className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-xs">
                          <MessagesSquare className="size-3" />
                          {t("table.replies", { count: tk.replyCount })}
                        </div>
                      )}
                    </td>
                    <td className="text-foreground px-4 py-3">{tk.customer?.name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">
                      <Badge tone={PRIORITY_TONE[tk.priority]}>{t(`priority.${tk.priority}`)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[tk.status]}>{t(`status.${tk.status}`)}</Badge>
                    </td>
                    <td className="text-foreground px-4 py-3">{tk.assignedTo?.name ?? <span className="text-muted-foreground">{t("table.unassigned")}</span>}</td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">{dateFmt.format(tk.createdAt)}</td>
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
        <LifeBuoy className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
