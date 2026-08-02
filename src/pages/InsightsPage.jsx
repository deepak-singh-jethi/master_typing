import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BarChart3,
  Clock3,
  Keyboard,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { AttemptTrendChart } from "@/components/insights/AttemptTrendChart";
import { KeyHeatmap } from "@/components/insights/KeyHeatmap";
import { WeeklyActivityChart } from "@/components/insights/WeeklyActivityChart";
import { useApp } from "@/hooks/useApp";
import { getStrongKeys, getWeakKeys } from "@/lib/metrics";
import { getBenchmarkStatus, getPerformanceSummary } from "@/lib/performance";
import { formatDateTime, formatDuration } from "@/lib/utils";

const filterOptions = [
  { value: "all", label: "All" },
  { value: "lesson", label: "Lessons" },
  { value: "practice", label: "Practice" },
  { value: "test", label: "Tests" },
];

export function InsightsPage() {
  const { data } = useApp();
  const [filter, setFilter] = useState("all");
  const weakKeys = getWeakKeys(data.statistics.keyStats, 8);
  const strongKeys = getStrongKeys(data.statistics.keyStats, 8);
  const performance = getPerformanceSummary(data.attempts);

  const filteredAttempts = useMemo(() => {
    if (filter === "all") return data.attempts;
    if (filter === "lesson") return data.attempts.filter((item) => item.type === "lesson" || item.type === "lesson-practice");
    return data.attempts.filter((item) => item.type === filter);
  }, [data.attempts, filter]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Local analytics"
        title="Understand what is improving and what needs work"
        description="The useful question is not only “How fast am I?” It is also which keys cause errors, whether your pace is stable, and whether accuracy remains strong in longer sessions."
        action={<Button as={Link} to="/practice" variant="brand">Start targeted practice<ArrowRight className="size-4" /></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard icon={Award} label="Course proficiency" value={performance.proficiency.bestLevel?.label ?? "Not assessed"} hint={performance.proficiency.bestAttempt ? `${Math.round(performance.proficiency.bestAttempt.netWpm)} WPM · ${Math.round(performance.proficiency.bestAttempt.accuracy)}% accuracy · ${performance.proficiency.count} valid assessments` : "Take a 3-minute level assessment to establish this measure"} />
        <MetricCard icon={ShieldCheck} label="Guided lessons" value={performance.lessons.count ? `${Math.round(performance.lessons.averageAccuracy)}%` : "Not set"} hint={performance.lessons.count ? `${Math.round(performance.lessons.averageWpm)} WPM average across ${performance.lessons.count} attempts` : "Complete guided exercises to establish lesson accuracy"} />
        <MetricCard icon={Target} label="Recovery transfer" value={performance.remediation.transferChecked ? `${performance.remediation.transferPassed}/${performance.remediation.transferChecked}` : "Not checked"} hint={performance.remediation.transferChecked ? `${Math.round(performance.remediation.transferRate)}% of fresh reassessments passed · ${performance.remediation.pendingTransfer} awaiting transfer check` : "Complete a targeted recovery, then verify it on fresh original-mode text"} />
        <MetricCard icon={BarChart3} label="Practical text" value={performance.practical.count ? `${Math.round(performance.practical.averageAccuracy)}%` : "Not set"} hint={performance.practical.count ? `${Math.round(performance.practical.averageWpm)} WPM average across ${performance.practical.count} sentence, paragraph, or custom-text sessions` : "Type sentences or paragraphs to establish this measure"} />
        <MetricCard icon={Keyboard} label="Number practice" value={performance.numbers.count ? `${Math.round(performance.numbers.averageAccuracy)}%` : "Not set"} hint={performance.numbers.count ? `${Math.round(performance.numbers.averageWpm)} WPM average across ${performance.numbers.count} number sessions` : "Number-row performance is measured separately"} />
        <MetricCard icon={Clock3} label="Total activity" value={formatDuration(data.progress.totalPracticeSeconds)} hint={`${data.progress.totalSessions} sessions · ${data.progress.totalCharacters.toLocaleString()} characters`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Comparable performance</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">1-minute progress trend</h2>
            </div>
            <TrendingUp className="size-5 text-indigo-500" />
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Only valid one-minute checks are compared. They show change over time but do not assign an official course level.</p>
          <div className="mt-5"><AttemptTrendChart attempts={performance.standardBenchmarkAttempts} emptyLabel="Complete two valid 60-second tests to see a comparable trend." /></div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Practice consistency</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Last 7 days</h2>
            </div>
            <BarChart3 className="size-5 text-indigo-500" />
          </div>
          <div className="mt-5"><WeeklyActivityChart activity={data.statistics.dailyActivity} goalMinutes={data.settings.dailyGoalMinutes} /></div>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Keyboard analysis</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Error heatmap</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Green keys are controlled, amber keys need attention, and red keys have the highest error rates. Keys with too little data remain grey.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
            <span className="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Strong</span>
            <span className="rounded-lg bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Developing</span>
            <span className="rounded-lg bg-rose-100 px-2 py-1 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Weak</span>
          </div>
        </div>
        <div className="mt-6"><KeyHeatmap keyStats={data.statistics.keyStats} /></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <KeyListCard
          icon={Target}
          title="Keys to practise next"
          description="Highest error rates with enough attempts to be meaningful."
          items={weakKeys}
          empty="No stable weak-key pattern yet. Complete more normal practice sessions."
          weak
        />
        <KeyListCard
          icon={ShieldCheck}
          title="Most reliable keys"
          description="Low error rates across at least 20 attempts."
          items={strongKeys}
          empty="More data is needed before strong keys can be identified."
        />
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Session history</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Recent attempts</h2>
          </div>
          <SegmentedControl value={filter} onChange={setFilter} options={filterOptions} />
        </div>

        {filteredAttempts.length > 0 ? (
          <div className="mt-5 space-y-2">
            {filteredAttempts.slice(0, 25).map((attempt) => (
              <AttemptRow key={attempt.id} attempt={attempt} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-slate-50 p-8 text-center dark:bg-slate-950/60">
            <p className="font-semibold text-slate-950 dark:text-white">No sessions in this category</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Complete a session and it will appear here automatically.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function KeyListCard({ icon: Icon, title, description, items, empty, weak = false }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 place-items-center rounded-2xl ${weak ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"}`}><Icon className="size-5" /></span>
        <div>
          <h2 className="font-semibold text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.key} className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-950/60">
              <p className="font-mono text-xl font-semibold text-slate-950 dark:text-white">{item.key}</p>
              <p className="mt-1 text-[10px] text-slate-400">{item.errorRate.toFixed(1)}% errors</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{item.attempts} attempts</p>
            </div>
          ))}
        </div>
      ) : <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">{empty}</p>}
    </Card>
  );
}

function AttemptRow({ attempt }) {
  const title = attempt.lessonTitle || attempt.testTitle || attempt.practiceTitle || attempt.type || "Typing session";
  const benchmarkStatus = getBenchmarkStatus(attempt);
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center dark:border-slate-800">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
          {benchmarkStatus && (
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${benchmarkStatus.valid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>
              {benchmarkStatus.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-400">{attempt.type} · {formatDateTime(attempt.completedAt)}</p>
      </div>
      <AttemptMetric label="WPM" value={Math.round(attempt.netWpm)} />
      <AttemptMetric label="Accuracy" value={`${Math.round(attempt.accuracy)}%`} />
      <AttemptMetric label="Consistency" value={`${Math.round(attempt.consistency || 0)}%`} />
      <AttemptMetric label="Time" value={formatDuration(attempt.durationSeconds)} />
    </div>
  );
}

function AttemptMetric({ label, value }) {
  return <div className="min-w-20 sm:text-right"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{value}</p></div>;
}
