import { Link } from "react-router-dom";
import { ArrowRight, Award, History } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { useApp } from "@/hooks/useApp";
import { testPresets } from "@/data/practicePresets";
import { getBenchmarkStatus } from "@/lib/performance";
import { COURSE_PROFICIENCY_LEVELS, getProficiencySummary } from "@/lib/proficiency";
import { formatDateTime } from "@/lib/utils";

export function TestsPage() {
  const { data } = useApp();
  const testAttempts = data.attempts.filter((item) => item.type === "test");
  const proficiency = getProficiencySummary(data.attempts);
  const levelAssessments = testPresets.filter((item) => item.assessment?.mode === "level");
  const progressChecks = testPresets.filter((item) => item.assessment?.mode !== "level");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Benchmarks"
        title="Check progress or assess your level"
        description="Short checks help you compare practice. A course level requires a longer, valid assessment with both pace and accuracy targets."
        action={<Button as={Link} to="/tests/consistency-180" variant="brand"><Award className="size-4" />Take assessment</Button>}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"><Award className="size-5" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Current course level</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{proficiency.bestLevel?.label ?? "Not assessed"}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                {proficiency.bestLevel
                  ? `${proficiency.bestLevel.description} Based on ${proficiency.count} valid level assessment${proficiency.count === 1 ? "" : "s"}.`
                  : "Complete the three-minute assessment for a Foundation or Functional result. Use five minutes when you are ready to demonstrate Proficient control."}
              </p>
            </div>
          </div>
          <Button as={Link} to={["functional", "proficient"].includes(proficiency.bestLevel?.id) ? "/tests/endurance-300" : "/tests/consistency-180"} variant="secondary" className="shrink-0">
            {proficiency.bestLevel ? "Assess again" : "Start 3-minute assessment"}<ArrowRight className="size-4" />
          </Button>
        </div>
      </Card>

      <section aria-labelledby="level-assessment-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">Level assessments</p>
          <h2 id="level-assessment-heading" className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Sustained measures that record a course level</h2>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {levelAssessments.map((test) => <TestCard key={test.id} test={test} best={data.personalBests[test.id]} />)}
        </div>
      </section>

      <section aria-labelledby="progress-check-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Progress checks</p>
          <h2 id="progress-check-heading" className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Short checks for practice comparison</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {progressChecks.map((test) => <TestCard key={test.id} test={test} best={data.personalBests[test.id]} compact />)}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Award className="size-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Course standards</p>
              <h2 className="mt-1 font-semibold text-slate-950 dark:text-white">Pace and accuracy both count</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {COURSE_PROFICIENCY_LEVELS.map((level) => (
              <div key={level.id} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/60">
                <div><p className="text-sm font-semibold text-slate-950 dark:text-white">{level.label}</p><p className="mt-0.5 text-[10px] text-slate-400">{level.minimumDurationSeconds / 60}-minute minimum</p></div>
                <p className="text-right text-sm font-semibold text-slate-700 dark:text-slate-200">{level.minimumWpm} WPM <span className="text-slate-400">·</span> {level.minimumAccuracy}%</p>
              </div>
            ))}
            <p className="px-1 text-[11px] leading-5 text-slate-400">Internal learning levels, not a formal typing certificate. Consistency is reported separately and never hides the pace or accuracy result.</p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Recent benchmarks</p>
              <h2 className="mt-1 font-semibold text-slate-950 dark:text-white">Test history</h2>
            </div>
            <History className="size-5 text-slate-400" />
          </div>

          {testAttempts.length > 0 ? (
            <>
              <div className="mt-5 space-y-3 sm:hidden">
                {testAttempts.slice(0, 8).map((attempt) => {
                  const status = getBenchmarkStatus(attempt);
                  return (
                    <article key={attempt.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{attempt.testTitle || attempt.testId}</h3>
                          <p className="mt-1 text-xs text-slate-400">{formatDateTime(attempt.completedAt)}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${status?.valid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>{status?.label || "Practice result"}</span>
                      </div>
                      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <ResultCell label="WPM" value={Math.round(attempt.netWpm)} />
                        <ResultCell label="Accuracy" value={`${Math.round(attempt.accuracy)}%`} />
                        <ResultCell label="Consistency" value={`${Math.round(attempt.consistency)}%`} />
                      </dl>
                    </article>
                  );
                })}
              </div>
              <div className="mt-5 hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <caption className="sr-only">Recent typing benchmark results</caption>
                  <thead className="text-[10px] uppercase tracking-[0.13em] text-slate-400">
                    <tr><th className="pb-3 font-semibold">Test</th><th className="pb-3 font-semibold">Status</th><th className="pb-3 font-semibold">WPM</th><th className="pb-3 font-semibold">Accuracy</th><th className="pb-3 font-semibold">Consistency</th><th className="pb-3 font-semibold">Date</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {testAttempts.slice(0, 8).map((attempt) => {
                      const status = getBenchmarkStatus(attempt);
                      return (
                        <tr key={attempt.id}>
                          <td className="py-3 font-semibold text-slate-950 dark:text-white">{attempt.testTitle || attempt.testId}</td>
                          <td className="py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${status?.valid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>{status?.label || "Practice result"}</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">{Math.round(attempt.netWpm)}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">{Math.round(attempt.accuracy)}%</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">{Math.round(attempt.consistency)}%</td>
                          <td className="py-3 text-xs text-slate-400">{formatDateTime(attempt.completedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState
              className="mt-5"
              icon={History}
              title="No benchmark history yet"
              description="Start with the one-minute progress check, then use a longer assessment when you want a course level."
              action={<Button as={Link} to="/tests/standard-60" variant="brand">Start progress check</Button>}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function TestCard({ test, best, compact = false }) {
  const kind = test.assessment?.mode === "level"
    ? "Level assessment"
    : test.assessment?.mode === "estimate"
      ? "Quick estimate"
      : "Practice check";
  return (
    <Link
      to={`/tests/${test.id}`}
      className="group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40 dark:hover:shadow-none"
    >
      {test.recommended && <span className="absolute right-4 top-4 rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">Recommended</span>}
      <span className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-600 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-slate-800 dark:text-slate-300"><test.icon className="size-5" /></span>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">{kind}</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{test.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{test.description}</p>
      <div className={`mt-5 flex items-end justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 ${compact ? "" : "min-h-16"}`}>
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">{test.personalBestEligible === false ? "Result handling" : "Best valid result"}</p><p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{test.personalBestEligible === false ? "History only" : best ? `${Math.round(best.netWpm)} WPM` : "Not set"}</p>{best && test.personalBestEligible !== false && <p className="mt-1 text-[10px] text-slate-400">{Math.round(best.accuracy)}% accuracy</p>}</div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">Start<ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  );
}

function ResultCell({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-3 dark:bg-slate-950/60">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{value}</dd>
    </div>
  );
}
