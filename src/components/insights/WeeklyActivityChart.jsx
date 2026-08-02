import { getLocalDateKey } from "@/lib/storage";
import { cn } from "@/lib/utils";

function getRecentDays(count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - index));
    return {
      key: getLocalDateKey(date),
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
      shortDate: new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date),
    };
  });
}

export function WeeklyActivityChart({ activity = {}, goalMinutes = 15, compact = false }) {
  const days = getRecentDays(7).map((day) => ({
    ...day,
    minutes: Math.round((activity[day.key]?.seconds || 0) / 60),
  }));
  const max = Math.max(goalMinutes, ...days.map((day) => day.minutes), 1);
  const summary = days.map((day) => `${day.label} ${day.minutes} minutes`).join(", ");

  return (
    <div role="img" aria-label={`Practice minutes for the last seven days. ${summary}. Daily goal ${goalMinutes} minutes.`}>
      <div aria-hidden="true" className={cn("grid grid-cols-7 gap-2", compact ? "h-28" : "h-44")}>
        {days.map((day) => (
          <div key={day.key} className="flex min-w-0 flex-col items-center gap-2">
            <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
              <div
                className={cn(
                  "w-full rounded-xl transition-all duration-500",
                  day.minutes >= goalMinutes ? "bg-emerald-500" : "bg-indigo-500",
                )}
                style={{ height: `${Math.max(day.minutes ? 8 : 0, Math.min(100, (day.minutes / max) * 100))}%` }}
                title={`${day.shortDate}: ${day.minutes} minutes`}
              />
              {!compact && day.minutes > 0 && (
                <span className="absolute inset-x-0 top-2 text-center text-[10px] font-bold text-slate-500 dark:text-slate-300">
                  {day.minutes}m
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold uppercase text-slate-400">{day.label.slice(0, 2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
