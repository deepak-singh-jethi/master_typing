import { useEffect, useRef } from "react";
import {
  ArrowRight,
  Award,
  BrainCircuit,
  CheckCircle2,
  Gauge,
  GitCompareArrows,
  Keyboard,
  Minus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { PaceChart } from "@/components/typing/PaceChart";
import { getPrimaryDiagnosis, summariseMasteryBlockers } from "@/lib/resultCoaching";
import { cn } from "@/lib/utils";

export function SessionResults({
  result,
  passed,
  passAccuracy = 0,
  requireComplete = false,
  onRetry,
  retryLabel = "Retry same text",
  onContinue,
  continueLabel = "Continue",
  onNewText,
  newTextLabel = "Fresh text, same recipe",
  onPracticeMistakes,
  resultContext = null,
  comparison = null,
  assessmentResult = null,
  masteryBlockers = [],
}) {
  const hasMistakes = result.difficultKeys?.length > 0
    || result.difficultBigrams?.length > 0
    || result.mistakeWords?.length > 0;
  const resultValid = result.validSession !== false && result.benchmarkValid !== false;
  const effectivePassed = passed && resultValid;
  const validationReasons = result.validationReasons?.length
    ? result.validationReasons
    : result.invalidReasons ?? [];
  const diagnosis = getPrimaryDiagnosis({
    result,
    passed: effectivePassed,
    passAccuracy,
    requireComplete,
    resultContext,
  });
  const masterySummary = summariseMasteryBlockers(masteryBlockers);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, []);

  return (
    <section aria-labelledby="result-heading" className="space-y-5">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "rounded-3xl border p-5 sm:p-7",
          diagnosis.tone === "emerald"
            ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/25 dark:bg-emerald-500/10"
            : "border-amber-200 bg-amber-50/80 dark:border-amber-500/25 dark:bg-amber-500/10",
        )}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl sm:size-12",
              diagnosis.tone === "emerald"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
            )}>
              {diagnosis.tone === "emerald"
                ? <CheckCircle2 className="size-6" aria-hidden="true" />
                : <TriangleAlert className="size-6" aria-hidden="true" />}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{diagnosis.eyebrow}</p>
              <h2 ref={headingRef} tabIndex={-1} id="result-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl dark:text-white">{diagnosis.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{diagnosis.summary}</p>
              <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-slate-700 dark:text-slate-200">Next: {diagnosis.action}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:max-w-lg lg:justify-end">
            {onContinue && (
              <Button variant="brand" onClick={onContinue} className="w-full sm:w-auto">
                {continueLabel}<ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            )}
            {!onContinue && hasMistakes && onPracticeMistakes && (
              <Button variant="brand" onClick={onPracticeMistakes} className="w-full sm:w-auto">
                Practise exact mistakes<ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            )}
            {onNewText && (
              <Button variant="secondary" onClick={onNewText} className="w-full sm:w-auto">
                <Sparkles className="size-4" aria-hidden="true" />{newTextLabel}
              </Button>
            )}
            <Button variant="ghost" onClick={onRetry} className="w-full sm:w-auto">
              <RefreshCcw className="size-4" aria-hidden="true" />{retryLabel}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ResultMetric icon={Gauge} label="Net WPM" value={Math.round(result.netWpm)} sub={`Gross ${Math.round(result.grossWpm)} WPM`} />
        <ResultMetric icon={ShieldCheck} label="Accuracy" value={`${Math.round(result.keystrokeAccuracy)}%`} sub={`${result.errors} incorrect inputs`} />
        <ResultMetric icon={Target} label="Consistency" value={`${Math.round(result.consistency)}%`} sub={`Burst ${Math.round(result.burstWpm)} WPM`} />
        <ResultMetric icon={CheckCircle2} label="Completion" value={`${Math.round(result.completion)}%`} sub={`${result.correctCharacters} correct characters`} />
      </div>

      {assessmentResult && <AssessmentResultCard assessment={assessmentResult} result={result} />}

      {comparison && <ComparisonCard comparison={comparison} />}

      {masteryBlockers.length > 0 && (
        <MasteryBlockers items={masteryBlockers} summary={masterySummary} />
      )}

      <details className="group rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-slate-950 marker:hidden sm:px-6 dark:text-white">
          <span>
            Detailed session analysis
            <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">Pace, corrections, recipe, and difficult patterns</span>
          </span>
          <span className="text-xs font-semibold text-indigo-600 group-open:hidden dark:text-indigo-400">Show</span>
          <span className="hidden text-xs font-semibold text-indigo-600 group-open:inline dark:text-indigo-400">Hide</span>
        </summary>

        <div className="space-y-5 border-t border-slate-200 p-5 sm:p-6 dark:border-slate-800">
          {result.benchmarkValid !== null && result.benchmarkValid !== undefined && (
            <div className={cn(
              "rounded-2xl border px-4 py-3 text-sm",
              result.benchmarkValid
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
            )}>
              <p className="font-semibold">
                {result.benchmarkValid
                  ? result.personalBestEligible === false
                    ? "Valid practice check — saved in history without a personal best."
                    : "Valid benchmark — eligible for a personal best."
                  : "Practice result only — personal best not updated."}
              </p>
              {!result.benchmarkValid && validationReasons.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                  {validationReasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              )}
            </div>
          )}

          {resultContext && <RecipeSummary context={resultContext} />}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ResultMetric icon={Keyboard} label="Final accuracy" value={`${Math.round(result.finalTextAccuracy)}%`} sub={`${result.uncorrectedErrors} left uncorrected`} compact />
            <ResultMetric icon={RefreshCcw} label="Correction rate" value={`${Math.round(result.correctionRate)}%`} sub={`${result.correctedErrors} errors fixed`} compact />
            <ResultMetric icon={Gauge} label="Gross pace" value={`${Math.round(result.grossWpm)} WPM`} sub="Before mistake penalty" compact />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/40">
              <h3 className="font-semibold text-slate-950 dark:text-white">Pace through the session</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Net WPM sampled once per active second. Paused time is excluded.</p>
              <div className="mt-4"><PaceChart samples={result.paceSamples} /></div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/40">
              <h3 className="font-semibold text-slate-950 dark:text-white">Difficult patterns</h3>
              {hasMistakes ? (
                <>
                  {result.difficultKeys?.length > 0 && (
                    <PatternList
                      title="Keys"
                      items={result.difficultKeys.slice(0, 6).map((item) => ({
                        key: item.key,
                        label: `${item.key === " " ? "Space" : item.key} · ${Math.round(item.errorRate)}% error`,
                      }))}
                      tone="rose"
                    />
                  )}
                  {result.difficultBigrams?.length > 0 && (
                    <PatternList
                      title="Key pairs"
                      items={result.difficultBigrams.slice(0, 5).map((item) => ({
                        key: item.key,
                        label: `${item.key.replaceAll(" ", "␣")} · ${Math.round(item.errorRate)}% error`,
                      }))}
                      tone="amber"
                    />
                  )}
                  {result.mistakeWords?.length > 0 && (
                    <PatternList
                      title="Words"
                      items={result.mistakeWords.slice(0, 8).map((item, index) => ({
                        key: `${item.expected}-${index}`,
                        label: item.expected,
                      }))}
                      tone="slate"
                    />
                  )}
                  {onPracticeMistakes && onContinue && (
                    <Button variant="secondary" className="mt-5 w-full" onClick={onPracticeMistakes}>Practise exact mistakes</Button>
                  )}
                </>
              ) : (
                <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                  No repeated problem pattern appeared. Continue with a longer text or slightly higher difficulty.
                </p>
              )}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

function AssessmentResultCard({ assessment, result }) {
  const next = assessment.nextLevel;
  const accuracy = Math.round(result.keystrokeAccuracy ?? result.accuracy ?? 0);
  const wpm = Math.round(result.netWpm ?? 0);
  const nextTarget = next
    ? `${next.minimumWpm} WPM with at least ${next.minimumAccuracy}% accuracy${next.minimumDurationSeconds >= 300 ? " for 5 minutes" : ""}`
    : "Maintain this control across fresh five-minute text.";

  return (
    <div className={cn(
      "rounded-3xl border p-5 sm:p-6",
      assessment.valid
        ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/20 dark:bg-indigo-500/5"
        : "border-amber-200 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5",
    )}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl",
            assessment.valid
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
          )}>
            <Award className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {assessment.official ? "Course proficiency" : "Quick estimate"}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              {assessment.valid
                ? `${assessment.levelLabel}${assessment.official ? " level" : " estimate"}`
                : "Assessment not recorded"}
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              {assessment.valid ? assessment.levelDescription : "This attempt did not meet the benchmark validity rules. Use fresh text and complete the full time without pausing."}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">{assessment.note}</p>
          </div>
        </div>

        {assessment.valid && (
          <div className="grid grid-cols-2 gap-2 sm:min-w-[24rem] sm:grid-cols-3">
            <AssessmentMetric label="Pace" value={`${wpm} WPM`} detail={assessment.paceBand.label} />
            <AssessmentMetric label="Accuracy" value={`${accuracy}%`} detail={assessment.accuracyBand.label} />
            <AssessmentMetric className="col-span-2 sm:col-span-1" label={next ? `Next: ${next.label}` : "Next target"} value={next ? `${next.minimumWpm} WPM` : "Maintain"} detail={nextTarget} />
          </div>
        )}
      </div>
    </div>
  );
}

function AssessmentMetric({ label, value, detail, className }) {
  return (
    <div className={cn("rounded-2xl bg-white px-3 py-3 shadow-sm dark:bg-slate-900", className)}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function ComparisonCard({ comparison }) {
  const metricRows = [
    ["Net WPM", comparison.metrics.netWpm],
    ["Accuracy", comparison.metrics.accuracy],
    ["Consistency", comparison.metrics.consistency],
    ["Completion", comparison.metrics.completion],
  ];

  return (
    <div className="rounded-3xl border border-sky-200 bg-sky-50/60 p-5 dark:border-sky-500/20 dark:bg-sky-500/5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
          <GitCompareArrows className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">Compared with the same mode</p>
          <h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{comparison.headline}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{comparison.summary}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metricRows.map(([label, metric]) => <ComparisonMetric key={label} label={label} metric={metric} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonMetric({ label, metric }) {
  const Icon = metric.direction === "up" ? TrendingUp : metric.direction === "down" ? TrendingDown : Minus;
  const positive = metric.direction === "up";
  const negative = metric.direction === "down";
  return (
    <div className="rounded-2xl bg-white px-3 py-3 shadow-sm dark:bg-slate-900">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={cn(
        "mt-2 inline-flex items-center gap-1 text-sm font-semibold",
        positive && "text-emerald-700 dark:text-emerald-300",
        negative && "text-rose-700 dark:text-rose-300",
        !positive && !negative && "text-slate-600 dark:text-slate-300",
      )}>
        <Icon className="size-3.5" aria-hidden="true" />{metric.label}
      </p>
    </div>
  );
}

function MasteryBlockers({ items, summary }) {
  return (
    <div className="rounded-3xl border border-violet-200 bg-violet-50/55 p-5 dark:border-violet-500/20 dark:bg-violet-500/5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          <Target className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Lesson mastery</p>
          <h3 className="mt-1 font-semibold text-slate-950 dark:text-white">
            {summary.complete ? "Every mastery requirement is complete" : `${summary.remaining.length} requirement${summary.remaining.length === 1 ? "" : "s"} remaining`}
          </h3>
          {summary.next && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Next priority: {summary.next.detail}</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className={cn(
                "rounded-2xl border p-3",
                item.passed
                  ? "border-emerald-200 bg-white dark:border-emerald-500/20 dark:bg-slate-900"
                  : "border-violet-200 bg-white dark:border-violet-500/20 dark:bg-slate-900",
              )}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{item.label}</p>
                  <span className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", item.passed ? "text-emerald-600" : "text-violet-600 dark:text-violet-300")}>{item.passed ? "Done" : "Needed"}</span>
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{item.current}{item.unit} <span className="text-xs font-medium text-slate-400">/ {item.target}{item.unit}</span></p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecipeSummary({ context }) {
  const patterns = [
    ...(context.focusKeys ?? []).map((item) => item === " " ? "Space" : item),
    ...(context.focusBigrams ?? []).map((item) => item.replaceAll(" ", "␣")),
    ...(context.recoveryWords ?? []).slice(0, 5),
  ].slice(0, 10);
  const confusions = (context.confusionPairs ?? [])
    .slice(0, 4)
    .map((item) => `${String(item.expected).replaceAll(" ", "␣")} → ${String(item.actual).replaceAll(" ", "␣")}`);
  const actualDensity = Math.round((Number(context.generatedFocusDensity) || 0) * 100);
  const uniqueRatio = Math.round((Number(context.uniqueRatio) || 0) * 100);
  const repeatRate = Math.round((Number(context.repeatRate) || 0) * 100);
  const sameFinger = Math.round((Number(context.sameFingerRatio) || 0) * 100);
  const alternation = Math.round((Number(context.alternationRatio) || 0) * 100);
  const motorScore = Math.round(Number(context.motorScore) || 0);

  return (
    <div className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <BrainCircuit className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">Session recipe</p>
            <h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{context.purposeLabel || "Practice"} · {context.skillStage || "adaptive"} stage</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Focus {actualDensity}% · unique {uniqueRatio}% · immediate repeat {repeatRate}%
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Motor difficulty {context.motorBand || context.difficulty || "balanced"} ({motorScore}) · same finger {sameFinger}% · alternation {alternation}%
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-xl lg:justify-end">
          {patterns.map((item, index) => (
            <span key={`${item}-${index}`} className="rounded-xl bg-white px-2.5 py-1.5 font-mono text-[11px] font-semibold text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300">{item}</span>
          ))}
          {confusions.map((item) => (
            <span key={item} className="rounded-xl bg-violet-100 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">{item}</span>
          ))}
          {!patterns.length && !confusions.length && (
            <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">Balanced baseline</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PatternList({ title, items, tone }) {
  const tones = {
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item.key} className={cn("rounded-xl px-3 py-1.5 font-mono text-xs font-semibold", tones[tone])}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function ResultMetric({ icon: Icon, label, value, sub, compact = false }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900", compact && "bg-slate-50/70 dark:bg-slate-950/30")}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        <Icon className="size-4" aria-hidden="true" />{label}
      </div>
      <p className={cn("mt-3 font-semibold tracking-tight text-slate-950 dark:text-white", compact ? "text-xl" : "text-xl sm:text-2xl")}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}
