import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, LifeBuoy, User } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { getTicketDetail } from "@/lib/support/queries";
import { Badge } from "@/components/ui/badge";
import { TicketStatusControl } from "@/components/support/ticket-status-control";
import { TicketReplyForm } from "@/components/support/ticket-reply-form";

const MODULE_KEY = "support";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const [t, ticket] = await Promise.all([
    getTranslations({ locale, namespace: "support" }),
    getTicketDetail(id),
  ]);
  return { title: ticket ? `${t("form.detailTitle")} — ${ticket.subject}` : t("title") };
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const t = await getTranslations({ locale, namespace: "support" });
  const ticket = await getTicketDetail(id);
  if (!ticket) notFound();

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-6">
      <Link href="/support" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("backToSupport")}
      </Link>

      <header className="border-border flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-xl">
            <LifeBuoy className="size-5" />
          </span>
          <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">{ticket.subject}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[ticket.status]}>{t(`status.${ticket.status}`)}</Badge>
            <Badge tone={PRIORITY_TONE[ticket.priority]}>{t(`priority.${ticket.priority}`)}</Badge>
            {ticket.customer && (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <User className="size-3.5" />
                {ticket.customer.name}
              </span>
            )}
            <span className="text-muted-foreground text-xs tabular-nums">{dateFmt.format(ticket.createdAt)}</span>
          </div>
        </div>
        <TicketStatusControl ticketId={ticket.id} status={ticket.status} />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
            <h2 className="font-display text-foreground mb-2 text-sm font-semibold">{t("form.originalMessage")}</h2>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{ticket.body}</p>
          </section>

          {ticket.replies.length > 0 && (
            <ul className="flex flex-col gap-3">
              {ticket.replies.map((r) => (
                <li key={r.id} className="bg-card shadow-soft border-border rounded-2xl border p-4">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-foreground text-sm font-semibold">{r.author.name}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">{dateFmt.format(r.createdAt)}</span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{r.body}</p>
                </li>
              ))}
            </ul>
          )}

          <TicketReplyForm ticketId={ticket.id} />
        </div>

        <aside className="flex flex-col gap-4">
          <section className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5">
            <h2 className="font-display text-foreground text-sm font-semibold">{t("form.sectionInfo")}</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{t("table.customer")}</dt>
                <dd className="text-foreground font-medium">{ticket.customer?.name ?? "—"}</dd>
              </div>
              {ticket.customer?.phone && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{t("form.customerPhone")}</dt>
                  <dd className="text-foreground font-medium" dir="ltr">
                    {ticket.customer.phone}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{t("table.assignedTo")}</dt>
                <dd className="text-foreground font-medium">{ticket.assignedTo?.name ?? t("table.unassigned")}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
