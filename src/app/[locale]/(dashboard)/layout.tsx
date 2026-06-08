import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/shell/sidebar-context";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileDrawer } from "@/components/shell/mobile-drawer";
import { Topbar } from "@/components/shell/topbar";
import { getCurrentUser } from "@/lib/auth/session";
import { allowedModules } from "@/lib/rbac";

/**
 * Dashboard shell. Wraps every module route with the persistent sidebar
 * (start-side, collapsible), the mobile drawer, and the topbar.
 *
 * Auth note: the middleware already redirects unauthenticated requests,
 * but we re-read the session here so the shell can (a) render the real
 * user in the topbar and (b) compute the role's allowed modules once and
 * pass them to the nav. The per-route RBAC guard lives in each module's
 * page wrapper, not here.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  // Defensive: middleware should have caught this, but never render the
  // shell without a session.
  if (!user) redirect(`/${locale}/login`);

  const navModules = allowedModules(user.role);

  return (
    <SidebarProvider>
      <div className="bg-background flex min-h-dvh">
        <Sidebar moduleKeys={navModules} />
        <MobileDrawer moduleKeys={navModules} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} locale={locale} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
