import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileSpreadsheet, Upload, Download, AlertTriangle, Clock } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { listImportExportJobs, getImportExportStats, type JobType } from "@/lib/catalog/import-export/queries";
import { formatNumber } from "@/lib/format";
import { CatalogHeader } from "@/components/catalog/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportPanel } from "@/components/catalog/import-export/export-panel";

const MODULE_KEY = "catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog.importExportPage" });
  return { title: t("title") };
}

const STATUS_TONE = {
  PENDING: "neutral",
  PROCESSING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
} as const;

const TYPE_TONE = {
  IMPORT: "info",
  EXPORT: "primary",
} as const;

export default async function ImportExportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "catalog.importExportPage" });

  const typeOptions = ["IMPORT", "EXPORT"] as const;
  const type = (typeOptions as readonly string[]).includes(sp.type ?? "") ? (sp.type as JobType) : undefined;
  const page = Number(sp.page) || 1;

  const [{ rows, total, pageCount }, stats, categories] = await Promise.all([
    listImportExportJobs({ type, page }),
    getImportExportStats(),
    prisma.category.findMany({ orderBy: { nameEn: "asc" }, select: { slug: true, nameEn: true, nameAr: true } }),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const hrefFor = (overrides: { type?: string; page?: number }) => {
    const params = new URLSearchParams();
    const ty = "type" in overrides ? overrides.type : type;
    const pg = "page" in overrides ? overrides.page : page;
    if (ty) params.set("type", ty);
    if (pg && pg > 1) params.set("page", String(pg));
    const qs = params.toString();
    return qs ? `/catalog/import-export?${qs}` : "/catalog/import-export";
  };

  const cards = [
    { icon: Upload, label: t("stats.totalImports"), value: formatNumber(stats.totalImports, locale), tone: "info" as const },
    { icon: Download, label: t("stats.totalExports"), value: formatNumber(stats.totalExports, locale), tone: "primary" as const },
    { icon: AlertTriangle, label: t("stats.failedJobs"), value: formatNumber(stats.failedJobs, locale), tone: "danger" as const },
    {
      icon: Clock,
      label: t("stats.lastJob"),
      value: stats.lastJobAt ? dateFmt.format(stats.lastJobAt) : "—",
      tone: "warning" as const,
    },
  ];
  const toneClass: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success/12 text-success",
    info: "bg-accent/15 text-accent-foreground",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/12 text-destructive",
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={FileSpreadsheet}
        action={
          <Link href="/catalog/import">
            <Button>
              <Upload />
              {t("startImport")}
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

      <ExportPanel categories={categories} locale={locale} />

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip href={hrefFor({ type: undefined })} active={!type} label={t("filter.all")} />
        {typeOptions.map((ty) => (
          <FilterChip key={ty} href={hrefFor({ type: ty })} active={type === ty} label={t(`type.${ty}`)} />
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-200 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.fileName")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.type")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.rowCount")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.createdBy")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.createdAt")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => (
                  <tr key={job.id} className="border-border hover:bg-muted/50 border-b transition-colors last:border-0">
                    <td className="text-foreground px-4 py-3 font-medium">{job.fileName}</td>
                    <td className="px-4 py-3">
                      <Badge tone={TYPE_TONE[job.type]}>{t(`type.${job.type}`)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[job.status]}>{t(`status.${job.status}`)}</Badge>
                    </td>
                    <td className="text-foreground px-4 py-3 tabular-nums">{job.rowCount != null ? formatNumber(job.rowCount, locale) : "—"}</td>
                    <td className="text-foreground px-4 py-3">{job.createdBy.name}</td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">{dateFmt.format(job.createdAt)}</td>
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
        <FileSpreadsheet className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
