import { Link, useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { LocalModeBadge } from "@/components/common/LocalModeBadge";
import { useApp } from "@/hooks/useApp";
import { useAuth } from "@/hooks/useAuth.js";
import { getPageMeta } from "@/lib/uiExperience";
import { cn } from "@/lib/utils";

function isFocusedLessonPath(pathname) {
  return /^\/learn\/[^/]+$/.test(pathname);
}

export function Header() {
  const location = useLocation();
  const meta = getPageMeta(location.pathname);
  const focusedLesson = isFocusedLessonPath(location.pathname);
  const { data, resolvedTheme, updateSettings } = useApp();
  const { user } = useAuth();
  const toggleTheme = () => {
    updateSettings({ theme: resolvedTheme === "dark" ? "light" : "dark" });
  };

  return (
    <header className={cn(
      "sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50/92 backdrop-blur-xl lg:ml-56 dark:border-slate-800 dark:bg-slate-950/92",
      focusedLesson && "dark:bg-[#050b18]/94",
    )}>
      <div className={cn(
        "mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8",
        focusedLesson ? "max-w-[1360px]" : "max-w-[1180px]",
      )}>
        <div className="flex min-w-0 items-center gap-3">
          <Logo compact className="shrink-0 lg:hidden" />
          {!focusedLesson && (
            <div className="min-w-0 lg:pl-0">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{meta.title}</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">{meta.description}</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden md:block"><LocalModeBadge compact /></div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === "dark" ? "Use light theme" : "Use dark theme"}
            className="grid size-11 place-items-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            {resolvedTheme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
          </button>
          <Link
            to="/account"
            className="grid size-11 place-items-center rounded-xl bg-slate-900 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            aria-label={user ? "Open account and backup status" : "Sign in or create account"}
          >
            {(data.profile.name || user?.email || "L").trim().charAt(0).toUpperCase()}
          </Link>
        </div>
      </div>
    </header>
  );
}
