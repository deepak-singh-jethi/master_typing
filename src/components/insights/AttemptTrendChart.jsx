export function AttemptTrendChart({ attempts = [], emptyLabel = "Complete two comparable sessions to see a trend." }) {
  const values = attempts.slice(0, 20).reverse().map((item) => Number(item.netWpm) || 0);
  if (values.length < 2) {
    return <div className="grid h-44 place-items-center rounded-2xl bg-slate-50 px-6 text-center text-sm text-slate-400 dark:bg-slate-950/60">{emptyLabel}</div>;
  }

  const width = 620;
  const height = 190;
  const max = Math.max(...values, 10);
  const points = values.map((value, index) => {
    const x = 10 + (index / Math.max(1, values.length - 1)) * (width - 20);
    const y = height - 20 - (value / max) * (height - 40);
    return `${x},${y}`;
  }).join(" ");
  const first = Math.round(values[0]);
  const latest = Math.round(values.at(-1));
  const direction = latest > first ? "up" : latest < first ? "down" : "unchanged";

  return (
    <div role="img" aria-label={`Net words per minute trend across ${values.length} comparable sessions. First ${first} WPM, latest ${latest} WPM, trend ${direction}.`} className="overflow-hidden rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60">
      <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
        ))}
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
