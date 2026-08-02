import { cn } from "@/lib/utils";

export function MetricCard({ icon: Icon, label, value, hint, className }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-xs">{label}</span>
        {Icon && <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />}
      </div>
      <p className="mt-3 truncate text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl dark:text-white">{value}</p>
      {hint && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500 sm:text-xs sm:leading-5 dark:text-slate-400">{hint}</p>}
    </div>
  );
}
