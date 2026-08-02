import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-950/40", className)}>
      {Icon && (
        <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-white text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
