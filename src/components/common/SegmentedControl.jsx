import { cn } from "@/lib/utils";

export function SegmentedControl({ value, onChange, options, className, label = "View options" }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex max-w-full overflow-x-auto rounded-2xl bg-slate-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:bg-slate-800", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "min-h-9 shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition focus-visible:ring-4 focus-visible:ring-indigo-500/20",
            value === option.value
              ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
