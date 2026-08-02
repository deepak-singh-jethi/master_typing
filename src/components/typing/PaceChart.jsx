export function PaceChart({ samples = [], height = 120 }) {
  const values = samples.filter((value) => Number.isFinite(value));
  if (values.length < 2) {
    return (
      <div className="grid h-[120px] place-items-center rounded-2xl bg-slate-50 text-xs text-slate-400 dark:bg-slate-950/60">
        Complete a longer session to see your pace curve.
      </div>
    );
  }

  const width = 520;
  const max = Math.max(...values, 10);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - 10 - ((value - min) / range) * (height - 20);
    return `${x},${y}`;
  }).join(" ");
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

  return (
    <div role="img" aria-label={`Typing pace curve with ${values.length} samples. Minimum ${Math.round(min)} WPM, average ${average} WPM, maximum ${Math.round(max)} WPM.`} className="overflow-hidden rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60">
      <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} className="h-[120px] w-full" preserveAspectRatio="none">
        <line x1="0" y1={height - 10} x2={width} y2={height - 10} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-indigo-600"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
