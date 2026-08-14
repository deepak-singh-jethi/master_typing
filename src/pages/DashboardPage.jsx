import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, BrainCircuit, CheckCircle2, Flame, Gauge, Play, Target } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { ProgressBar } from "@/components/common/ProgressBar";
import { useApp } from "@/hooks/useApp";
import { getCourseProgress, getNextRecommendedLesson, getReviewQueue } from "@/lib/adaptiveLearning";
import { getLocalDateKey } from "@/lib/storage";
import { getPlanCompletionLabel, getPrimaryDashboardAction } from "@/lib/uiExperience";
import { cn, getGreeting, percentage } from "@/lib/utils";

export function DashboardPage() {
  const { data } = useApp();
  const nextLesson = getNextRecommendedLesson(data);
  const reviewQueue = getReviewQueue(data);
  const course = getCourseProgress(data);
  const today = data.statistics.dailyActivity[getLocalDateKey()] ?? { seconds: 0, sessions: 0 };
  const todayMinutes = Math.floor(today.seconds / 60);
  const dailyProgress = percentage(todayMinutes, data.settings.dailyGoalMinutes);
  const primaryAction = getPrimaryDashboardAction({
    onboardingCompleted: data.onboarding.completed,
    reviewQueue,
    nextLesson,
  });

  const smartConfig = {
    purpose: "adaptive",
    contentType: "words",
    category: "general",
    goalType: "time",
    durationSeconds: 300,
    difficulty: "adaptive",
    targetDensity: 0.4,
    presetId: "smart",
    seed: Date.now(),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="pt-2">
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Today</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] text-slate-950 dark:text-white">
          {getGreeting()}, {data.profile.name}.
        </h1>
        <p className="mt-2 text-base text-slate-500 dark:text-slate-400">Choose one useful session and start typing.</p>
      </header>

      <Card as="section" aria-labelledby="next-action-title" className="overflow-hidden border-indigo-200 dark:border-indigo-500/30">
        <div className="grid lg:grid-cols-[1fr_280px]">
          <div className="p-7 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">{primaryAction.eyebrow}</p>
            <h2 id="next-action-title" className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{primaryAction.title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">{primaryAction.description}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button as={Link} to={primaryAction.to} variant="brand" size="lg">
                <Play className="size-4" aria-hidden="true" />{primaryAction.label}
              </Button>
              {primaryAction.secondaryAction && (
                <Button as={Link} to={primaryAction.secondaryAction.to} variant="secondary" size="lg">
                  {primaryAction.secondaryAction.label}<ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/80 p-7 lg:border-l lg:border-t-0 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Daily goal</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{todayMinutes}<span className="ml-1 text-base text-slate-400">/ {data.settings.dailyGoalMinutes} min</span></p>
              </div>
              <span className={cn("grid size-10 place-items-center rounded-xl", dailyProgress >= 100 ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15")}>
                {dailyProgress >= 100 ? <CheckCircle2 className="size-5" /> : <Target className="size-5" />}
              </span>
            </div>
            <ProgressBar value={dailyProgress} className="mt-5" />
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{getPlanCompletionLabel({ completedMinutes: todayMinutes, goalMinutes: data.settings.dailyGoalMinutes })}</p>
          </div>
        </div>
      </Card>

      <section aria-labelledby="choose-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Choose a route</p>
            <h2 id="choose-title" className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">What do you want to do?</h2>
          </div>
          <Button as={Link} to="/insights" variant="ghost" size="sm">View progress<ArrowRight className="size-4" /></Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <RouteCard to={nextLesson ? `/learn/${nextLesson.id}` : "/learn"} icon={BookOpen} title="Continue learning" description={nextLesson ? `Lesson ${nextLesson.number}: ${nextLesson.title}` : "Review your course path"} />
          <RouteCard to="/practice/session" state={{ config: smartConfig }} icon={BrainCircuit} title="Smart practice" description="A focused 5-minute review" />
          <RouteCard to="/tests" icon={Gauge} title="Take a test" description="Check your current speed" />
        </div>
      </section>

      <Card className="flex flex-wrap items-center justify-between gap-5 p-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Summary label="Course" value={`${Math.round(course.percentage)}%`} />
          <Summary label="Lessons mastered" value={course.masteredCount} />
          <Summary label="Current streak" value={`${data.progress.currentStreak} day${data.progress.currentStreak === 1 ? "" : "s"}`} icon={Flame} />
        </div>
        <Button as={Link} to="/learn" variant="secondary" size="sm">Open course<ArrowRight className="size-4" /></Button>
      </Card>
    </div>
  );
}

function RouteCard({ to, state, icon: Icon, title, description }) {
  return (
    <Link to={to} state={state} className="group rounded-3xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40">
      <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><Icon className="size-5" /></span>
      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
      </div>
    </Link>
  );
}

function Summary({ label, value, icon: Icon }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-lg font-semibold text-slate-950 dark:text-white">{Icon && <Icon className="size-4 text-orange-500" />}{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
