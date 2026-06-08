import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Users, Gift, Wallet } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listCustomers } from "@/lib/customers/queries";
import { formatNumber, formatSar } from "@/lib/money";
import { CatalogHeader } from "@/components/catalog/page-header";
import { CustomersToolbar } from "@/components/customers/customers-toolbar";
import { Badge } from "@/components/ui/badge";

const MODULE_KEY = "customers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "customers" });
  return { title: t("title") };
}

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "customers" });

  const search = sp.q ?? "";
  const type = sp.type === "RETAIL" ? "RETAIL" : sp.type === "B2B_SALON" ? "B2B_SALON" : undefined;
  const page = Number(sp.page) || 1;

  const { rows, total, pageCount } = await listCustomers({ search, type, page });

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (type) params.set("type", type);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/customers?${qs}` : "/customers";
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader title={t("title")} subtitle={t("subtitle")} icon={Users} />

      <CustomersToolbar initialSearch={search} initialType={sp.type ?? ""} />

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-220 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.name")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.type")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.city")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.phone")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("table.loyaltyPoints")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.pricingTier")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("table.credit")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="border-border hover:bg-muted/50 group border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${c.id}`}
                        className="text-foreground hover:text-primary font-medium underline-offset-4 group-hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.email && <div className="text-muted-foreground text-xs">{c.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {c.type === "B2B_SALON" ? (
                        <Badge tone="primary">{t("type.B2B_SALON")}</Badge>
                      ) : (
                        <Badge tone="outline">{t("type.RETAIL")}</Badge>
                      )}
                    </td>
                    <td className="text-foreground px-4 py-3">{c.city}</td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs tabular-nums" dir="ltr">
                      {c.phone}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <span className="text-foreground inline-flex items-center justify-end gap-1 tabular-nums">
                        <Gift className="text-muted-foreground size-3.5" />
                        {formatNumber(c.loyaltyPoints, locale)}
                      </span>
                    </td>
                    <td className="text-foreground px-4 py-3">
                      {c.pricingTier ? c.pricingTier.name : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {c.creditLimit !== null ? (
                        <span className="text-foreground inline-flex items-center justify-end gap-1 tabular-nums">
                          <Wallet className="text-muted-foreground size-3.5" />
                          {formatSar(c.creditBalance ?? "0", locale)}
                          <span className="text-muted-foreground">
                            / {formatSar(c.creditLimit, locale)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-border flex items-center justify-between gap-4 border-t px-4 py-3">
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
        <Users className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
