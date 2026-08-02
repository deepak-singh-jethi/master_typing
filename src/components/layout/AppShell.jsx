import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { AppStatusBanner } from "@/components/layout/AppStatusBanner";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { RouteAnnouncer } from "@/components/layout/RouteAnnouncer";
import { Sidebar } from "@/components/layout/Sidebar";
import { useApp } from "@/hooks/useApp";

export function AppShell() {
  const location = useLocation();
  const { data } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0"
      >
        Skip to main content
      </a>
      <RouteAnnouncer />
      <Sidebar />
      <Header />
      <AppStatusBanner />
      <main id="main-content" tabIndex={-1} className="pb-24 lg:ml-56 lg:pb-10">
        <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={data.settings.reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={data.settings.reduceMotion ? undefined : { opacity: 0, y: -2 }}
              transition={{ duration: data.settings.reduceMotion ? 0 : 0.15 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
