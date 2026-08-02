import { Link, NavLink } from "react-router-dom";
import { Award } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { navigationItems } from "@/components/layout/navigation";
import { ProgressBar } from "@/components/common/ProgressBar";
import { useApp } from "@/hooks/useApp";
import { getCourseProgress } from "@/lib/adaptiveLearning";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { data } = useApp();
  const course = getCourseProgress(data);
  const courseProgress = course.percentage;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-slate-200/80 bg-white px-4 py-5 lg:flex lg:flex-col dark:border-slate-800 dark:bg-slate-950">
      <div className="px-2">
        <Logo />
      </div>

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

      <Link to="/learn" aria-label={`Open course, ${Math.round(courseProgress)} percent complete`} className="group mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-3.5 transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Award className="size-4 text-indigo-500" aria-hidden="true" />
            Course
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white">{Math.round(courseProgress)}%</span>
        </div>
        <ProgressBar value={courseProgress} className="mt-3" />
        <p className="mt-2 text-[10px] font-medium text-slate-400 transition group-hover:text-indigo-600 dark:group-hover:text-indigo-300">Open learning path</p>
      </Link>
    </aside>
  );
}
