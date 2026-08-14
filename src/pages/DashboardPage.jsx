import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Play,
  RefreshCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { ProgressBar } from "@/components/common/ProgressBar";
import { useApp } from "@/hooks/useApp";
import { getCourseProgress, getNextRecommendedLesson, getReviewQueue } from "@/lib/adaptiveLearning";
import { getLocalDateKey } from "@/lib/storage";
import {
  getDashboardReviewAction,
  getPlanCompletionLabel,
  getPrimaryDashboardAction,
} from "@/lib/uiExperience";
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
    nextLesson,
  });
  const reviewAction = getDashboardReviewAction(reviewQueue);

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
    <div className="mx-auto max-w-6xl space-y-6 pb-6">
      <header className="pt-1 sm:pt-2">
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Today</p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl dark:text-white">
          {getGreeting()}, {data.profile.name}.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base dark:text-slate-400">
          Continue your course first. Short reviews keep earlier movements fresh without changing your lesson position.
        </p>
      </header>

      <section aria-label="Your learning priorities" className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.72fr)]">
        <CourseHero
          action={primaryAction}
          course={course}
          onboardingCompleted={data.onboarding.completed}
        />
        <ReviewPanel
          action={reviewAction}
          masteredCount={course.masteredCount}
        />
      </section>

      <section aria-labelledby="practice-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">More options</p>
            <h2 id="practice-title" className="mt-1.5 text-xl font-semibold text-slate-950 dark:text-white">
              More ways to practice
            </h2>
          </div>
          <Button as={Link} to="/insights" variant="ghost" size="sm">
            View progress <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <QuickActionCard
            to="/practice/session"
            state={{ config: smartConfig }}
            icon={BrainCircuit}
            title="Smart practice"
            description="Spend 5 minutes on the keys and movements that need the most work."
            meta="Adaptive · 5 min"
          />
          <QuickActionCard
            to="/tests"
            icon={Gauge}
            title="Take a typing test"
            description="Measure your current speed and accuracy when you want a progress check."
            meta="Optional assessment"
          />
        </div>
      </section>

      <TodaySummary
        todayMinutes={todayMinutes}
        goalMinutes={data.settings.dailyGoalMinutes}
        dailyProgress={dailyProgress}
        sessions={today.sessions ?? 0}
        streak={data.progress.currentStreak}
      />
    </div>
  );
}

function CourseHero({ action, course, onboardingCompleted }) {
  const isLesson = action.kind === "lesson";

  return (
    <Card
      as="section"
      aria-labelledby="course-action-title"
      className="relative overflow-hidden border-indigo-200/90 dark:border-indigo-500/30"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-indigo-600" aria-hidden="true" />
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <BookOpen className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
                {isLesson ? "Continue course" : action.eyebrow}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {isLesson ? "Your main learning path" : "Your next course action"}
              </p>
            </div>
          </div>

          {onboardingCompleted && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
              {Math.round(course.percentage)}% complete
            </span>
          )}
        </div>

        <div className="mt-7">
          {isLesson && (
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{action.eyebrow}</p>
          )}
          <h2
            id="course-action-title"
            className="mt-1 text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-[2.65rem] dark:text-white"
          >
            {action.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {action.description}
          </p>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button as={Link} to={action.to} variant="brand" size="lg" className="min-w-40">
            {action.kind === "setup" ? <Sparkles className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            {action.label}
          </Button>
          {onboardingCompleted && (
            <Button as={Link} to="/learn" variant="secondary" size="lg">
              View course <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        {onboardingCompleted && (
          <div className="mt-8 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">
                {course.masteredCount} mastered
                {course.creditedCount > 0 ? ` · ${course.creditedCount} placement credit${course.creditedCount === 1 ? "" : "s"}` : ""}
              </span>
              <span className="text-slate-400">{course.reachedCount} of {course.total} lessons covered</span>
            </div>
            <ProgressBar value={course.percentage} label="Course progress" />
          </div>
        )}
      </div>
    </Card>
  );
}

function ReviewPanel({ action, masteredCount }) {
  const hasReview = Boolean(action);

  return (
    <Card
      as="section"
      aria-labelledby="review-panel-title"
      className={cn(
        "flex min-h-full flex-col p-6 sm:p-7",
        hasReview && "border-violet-200/90 bg-violet-50/25 dark:border-violet-500/25 dark:bg-violet-500/[0.035]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn(
          "grid size-10 place-items-center rounded-2xl",
          hasReview
            ? "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
        )}>
          {hasReview ? <RefreshCcw className="size-5" aria-hidden="true" /> : <CheckCircle2 className="size-5" aria-hidden="true" />}
        </span>
        {hasReview && (
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            {action.dueCount} due
          </span>
        )}
      </div>

      <div className="mt-5 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          {hasReview ? "Review due" : "Reviews"}
        </p>
        <h2 id="review-panel-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          {hasReview ? action.title : masteredCount > 0 ? "You're caught up" : "Nothing due yet"}
        </h2>

        {hasReview ? (
          <>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Clock3 className="size-4" aria-hidden="true" />
              About 2 minutes · retention check
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Keep a mastered movement fresh. This review does not replace or move your current course lesson.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {masteredCount > 0
              ? "No spaced review needs your attention right now. Keep moving through the course."
              : "Reviews appear here after you master lessons and enough time has passed to check retention."}
          </p>
        )}
      </div>

      {hasReview && (
        <div className="mt-6">
          <Button as={Link} to={action.to} variant="secondary" size="lg" className="w-full">
            <RefreshCcw className="size-4" aria-hidden="true" />
            {action.label}
          </Button>
          {action.dueCount > 1 && (
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">
              Start with the oldest due review. {action.dueCount - 1} more will remain afterwards.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function QuickActionCard({ to, state, icon: Icon, title, description, meta }) {
  return (
    <Link
      to={to}
      state={state}
      className="group flex min-h-32 items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" aria-hidden="true" />
        </div>
        <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{meta}</p>
      </div>
    </Link>
  );
}

function TodaySummary({ todayMinutes, goalMinutes, dailyProgress, sessions, streak }) {
  const goalComplete = dailyProgress >= 100;

  return (
    <Card as="section" aria-label="Today at a glance" className="p-5 sm:px-6">
      <div className="grid gap-5 sm:grid-cols-3 sm:divide-x sm:divide-slate-100 dark:sm:divide-slate-800">
        <Summary
          icon={goalComplete ? CheckCircle2 : Target}
          label={getPlanCompletionLabel({ completedMinutes: todayMinutes, goalMinutes })}
          value={goalMinutes > 0 ? `${todayMinutes} / ${goalMinutes} min` : `${todayMinutes} min`}
          accent={goalComplete ? "success" : "brand"}
        />
        <Summary
          icon={Flame}
          label="Current streak"
          value={`${streak} day${streak === 1 ? "" : "s"}`}
          accent="warm"
        />
        <Summary
          icon={Clock3}
          label="Sessions today"
          value={sessions}
        />
      </div>
    </Card>
  );
}

function Summary({ label, value, icon: Icon, accent = "neutral" }) {
  return (
    <div className="flex items-center gap-3 sm:px-5 sm:first:pl-0 sm:last:pr-0">
      <span className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl",
        accent === "success" && "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
        accent === "brand" && "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
        accent === "warm" && "bg-orange-50 text-orange-500 dark:bg-orange-500/10 dark:text-orange-300",
        accent === "neutral" && "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
      )}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-lg font-semibold leading-none text-slate-950 dark:text-white">{value}</p>
        <p className="mt-1.5 text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}
