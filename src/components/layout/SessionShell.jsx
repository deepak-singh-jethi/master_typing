import { Outlet } from "react-router-dom";
import { Logo } from "@/components/layout/Logo";
import { LocalModeBadge } from "@/components/common/LocalModeBadge";
import { RouteAnnouncer } from "@/components/layout/RouteAnnouncer";

export function SessionShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#session-content"
        className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0"
      >
        Skip to session
      </a>
      <RouteAnnouncer />
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/92 backdrop-blur dark:border-slate-800 dark:bg-slate-950/92">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <Logo compact />
          <LocalModeBadge compact />
        </div>
      </header>
      <main id="session-content" tabIndex={-1} className="mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
