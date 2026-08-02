import { NavLink } from "react-router-dom";
import { mobileNavigationItems } from "@/components/layout/navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden dark:border-slate-800 dark:bg-slate-950/96">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {mobileNavigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition",
              isActive
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200",
            )}
          >
            <item.icon className="size-[19px]" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
