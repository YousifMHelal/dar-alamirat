import { SidebarProvider } from "@/components/shell/sidebar-context";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileDrawer } from "@/components/shell/mobile-drawer";
import { Topbar } from "@/components/shell/topbar";

/**
 * Dashboard shell. Wraps every module route with the persistent sidebar
 * (start-side, collapsible), the mobile drawer, and the topbar. The flex
 * row + logical borders mean the whole frame mirrors for RTL with zero
 * per-component overrides.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="bg-background flex min-h-dvh">
        <Sidebar />
        <MobileDrawer />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
