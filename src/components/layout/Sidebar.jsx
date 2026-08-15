import { Link, NavLink } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { navigationItems } from "@/components/layout/navigation";
import { useApp } from "@/hooks/useApp";
import { getCourseProgress } from "@/lib/adaptiveLearning";
import { cn } from "@/lib/utils";

function CourseArc({ value }) {
  const progress = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <svg viewBox="0 0 120 66" className="mt-1 h-16 w-full" aria-hidden="true">
      <path
        d="M14 56 A48 48 0 0 1 106 56"
        pathLength="100"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        className="text-slate-200 dark:text-slate-800"
      />
      <path
        d="M14 56 A48 48 0 0 1 106 56"
        pathLength="100"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${progress} 100`}
        className="text-violet-600"
      />
    </svg>
  );
}

export function Sidebar() {
  const { data, resolvedTheme, updateSettings } = useApp();
  const course = getCourseProgress(data);
  const courseProgress = course.percentage;
  const totalLessons = course.totalLessons || 27;
  const masteredLessons = data.progress.completedLessons.length;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 overflow-y-auto border-r border-slate-200/80 bg-white px-4 py-5 lg:flex lg:flex-col dark:border-slate-800 dark:bg-[#07101d]">
      <div className="px-2"><Logo /></div>

      <nav aria-label="Primary navigation" className="mt-8 space-y-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn(
              "group flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition",
              isActive
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white",
            )}
          >
            <item.icon className="size-[18px]" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 pt-6">
        <Link
          to="/learn"
          aria-label={`Open course map, ${Math.round(courseProgress)} percent complete`}
          className="group block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-violet-300 dark:border-slate-800 dark:bg-[#0a1422] dark:hover:border-violet-500/40"
        >
          <div className="px-4 pt-4">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Course progress</p>
            <p className="mt-2 text-3xl font-bold tracking-[-0.04em] text-violet-600 dark:text-violet-400">{Math.round(courseProgress)}%</p>
            <CourseArc value={courseProgress} />
          </div>
          <div className="border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {masteredLessons} / {totalLessons} lessons mastered
          </div>
          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            <span className="flex min-h-9 items-center justify-center rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white transition group-hover:bg-violet-500">View course map →</span>
          </div>
        </Link>


        <button
          type="button"
          onClick={() => updateSettings({ theme: resolvedTheme === "dark" ? "light" : "dark" })}
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-800 dark:bg-[#0a1422] dark:text-slate-300 dark:hover:border-violet-500/40 dark:hover:text-violet-300"
        >
          <span className="inline-flex items-center gap-2">
            {resolvedTheme === "dark" ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
            Dark mode
          </span>
          <span className={cn("relative h-5 w-9 rounded-full transition", resolvedTheme === "dark" ? "bg-violet-600" : "bg-slate-300")} aria-hidden="true">
            <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition", resolvedTheme === "dark" ? "left-[1.1rem]" : "left-0.5")} />
          </span>
        </button>
      </div>
    </aside>
  );
}
