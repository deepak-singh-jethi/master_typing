import { cn, clamp } from "@/lib/utils";

export function ProgressBar({ value = 0, className, barClassName, label = "" }) {
  const safeValue = clamp(Number(value) || 0, 0, 100);
  const accessibility = label
    ? { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(safeValue) }
    : { "aria-hidden": "true" };

  return (
    <div {...accessibility} className={cn("h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800", className)}>
      <div
        className={cn("h-full rounded-full bg-indigo-600 transition-[width] duration-500", barClassName)}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
