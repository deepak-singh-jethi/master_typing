import { getKeyErrorRate } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const rows = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
];

function heatClass(rate, attempts) {
  if (attempts < 5) return "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500";
  if (rate < 2) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (rate < 5) return "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300";
  if (rate < 10) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
}

export function KeyHeatmap({ keyStats = {} }) {
  const summary = rows.flat().map((key) => {
    const stat = keyStats[key] ?? {};
    const attempts = Number(stat.attempts) || 0;
    return `${key.toUpperCase()} ${attempts} attempts ${getKeyErrorRate(stat).toFixed(1)} percent errors`;
  }).join(", ");

  return (
    <div role="img" aria-label={`Key error heatmap. ${summary}.`} className="overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div aria-hidden="true" className="min-w-[520px] space-y-2">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className={cn("flex gap-2", rowIndex === 1 && "pl-4", rowIndex === 2 && "pl-9")}>
            {row.map((key) => {
              const stat = keyStats[key] ?? {};
              const attempts = Number(stat.attempts) || 0;
              const rate = getKeyErrorRate(stat);
              return (
                <div
                  key={key}
                  title={`${key.toUpperCase()}: ${attempts} attempts, ${rate.toFixed(1)}% errors`}
                  className={cn("grid size-11 place-items-center rounded-xl font-mono text-sm font-semibold", heatClass(rate, attempts))}
                >
                  {key}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
