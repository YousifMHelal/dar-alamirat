import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserCog, Mail } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listStaff } from "@/lib/staff/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { RoleFilter } from "@/components/staff/role-filter";
import { Badge } from "@/components/ui/badge";

const MODULE_KEY = "staff";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "staff" });
  return { title: t("title") };
}

const ROLE_TONE = {
  ADMIN: "primary",
  MANAGER: "info",
  B2B_SALON: "outline",
} as const;

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ role?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireModuleAccess(MODULE_KEY, locale);

  // Staff accounts are admin-only — managers can see the module entry but not the data.
  if (user.role !== "ADMIN") {
    redirect(`/${locale}/overview`);
  }

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "staff" });

  const role =
    sp.role === "ADMIN" || sp.role === "MANAGER" || sp.role === "B2B_SALON" ? sp.role : undefined;
  const page = Number(sp.page) || 1;

  const { rows, total, pageCount } = await listStaff({ role, page });

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/staff?${qs}` : "/staff";
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader title={t("title")} subtitle={t("subtitle")} icon={UserCog} />

      <RoleFilter current={sp.role ?? ""} />

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-180 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.name")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.email")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.role")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className="border-border hover:bg-muted/50 border-b transition-colors last:border-0"
                  >
                    <td className="text-foreground px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                        <Mail className="size-3.5" />
                        <span className="break-all">{u.email}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ROLE_TONE[u.role]}>{t(`roles.${u.role}`)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.active ? (
                        <Badge tone="success">{t("table.active")}</Badge>
                      ) : (
                        <Badge tone="neutral">{t("table.inactive")}</Badge>
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
        <UserCog className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
