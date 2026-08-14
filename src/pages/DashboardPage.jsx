import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Keyboard,
  Play,
  RefreshCw,
  Target,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { useApp } from "@/hooks/useApp";
import { getCourseProgress, getNextRecommendedLesson, getReviewQueue } from "@/lib/adaptiveLearning";
import { getLocalDateKey } from "@/lib/storage";
import { getPlanCompletionLabel, getPrimaryDashboardAction } from "@/lib/uiExperience";
import { cn, getGreeting, percentage } from "@/lib/utils";

export function DashboardPage() {
  const { data } = useApp();
  const nextLesson = getNextRecommendedLesson(data);
  const reviewQueue = getReviewQueue(data);
  const dueReview = reviewQueue[0] ?? null;
  const course = getCourseProgress(data);
  const todayKey = getLocalDateKey();
  const today = data.statistics.dailyActivity[todayKey] ?? { seconds: 0, sessions: 0, averageAccuracy: 0 };
  const todayMinutes = Math.floor(today.seconds / 60);
  const dailyProgress = percentage(todayMinutes, data.settings.dailyGoalMinutes);
  const dailyGoalComplete = dailyProgress >= 100;
  const courseAction = getPrimaryDashboardAction({
    onboardingCompleted: data.onboarding.completed,
    reviewQueue: [],
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
    <div className="mx-auto max-w-[1160px] space-y-5 sm:space-y-6">
      <DashboardHeader name={data.profile.name} />

      <section aria-label="Learning and review" className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <CourseHero
          action={courseAction}
          lesson={nextLesson}
          course={course}
          streak={data.progress.currentStreak}
        />
        <ReviewCard review={dueReview} dueCount={reviewQueue.length} />
      </section>

      <section aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="sr-only">Quick actions</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <QuickAction
            to="/practice/session"
            state={{ config: smartConfig }}
            icon={BrainCircuit}
            tone="indigo"
            title="Smart practice"
            description="Focus on weak areas with a personalised session."
          />
          <QuickAction
            to="/tests"
            icon={Gauge}
            tone="orange"
            title="Take a test"
            description="Check your current speed and accuracy."
          />
          <QuickAction
            to="/learn"
            icon={BookOpen}
            tone="blue"
            title="Browse course"
            description="Explore every lesson and your learning path."
          />
        </div>
      </section>

      <section aria-label="Today's progress" className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <TodayGlance
          minutes={todayMinutes}
          goalMinutes={data.settings.dailyGoalMinutes}
          sessions={today.sessions ?? 0}
          accuracy={today.averageAccuracy ?? 0}
          streak={data.progress.currentStreak}
          goalComplete={dailyGoalComplete}
        />
        <StreakCalendar dailyActivity={data.statistics.dailyActivity} />
      </section>
    </div>
  );
}

function DashboardHeader({ name }) {
  return (
    <header className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl dark:text-white">
          {getGreeting()}, {name}.
        </h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base dark:text-slate-400">
          Let’s make today a productive typing session.
        </p>
      </div>
    </header>
  );
}

function CourseHero({ action, lesson, course, streak }) {
  const isLesson = action.kind === "lesson" && lesson;

  return (
    <Card
      as="section"
      aria-labelledby="course-hero-title"
      className="relative isolate overflow-hidden border-indigo-200/80 shadow-[0_18px_45px_-32px_rgba(79,70,229,0.42)] dark:border-indigo-500/25"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 -z-10 size-72 rounded-full bg-indigo-100/65 blur-3xl dark:bg-indigo-500/10" />
      <div className="pointer-events-none absolute bottom-10 right-32 -z-10 size-28 rounded-full bg-violet-100/70 blur-2xl dark:bg-violet-500/10" />

      <div className="grid min-h-[315px] sm:grid-cols-[minmax(0,1fr)_230px]">
        <div className="flex flex-col p-6 sm:p-7 lg:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">
            <span className="grid size-7 place-items-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
              <Keyboard className="size-4" aria-hidden="true" />
            </span>
            {isLesson ? "Continue learning" : action.eyebrow}
          </div>

          {isLesson ? (
            <>
              <p className="mt-5 text-base font-semibold text-slate-700 dark:text-slate-200">Lesson {lesson.number}</p>
              <h2 id="course-hero-title" className="mt-1 text-4xl font-semibold tracking-[-0.04em] text-indigo-600 sm:text-[2.7rem] dark:text-indigo-300">
                {lesson.title}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-400">
                {lesson.subtitle || "Continue your guided touch-typing path."}
              </p>
            </>
          ) : (
            <>
              <h2 id="course-hero-title" className="mt-5 max-w-lg text-3xl font-semibold tracking-[-0.035em] text-slate-950 dark:text-white">
                {action.title}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-400">{action.description}</p>
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button as={Link} to={action.to} variant="brand" size="lg">
              <Play className="size-4" aria-hidden="true" />
              {action.label}
            </Button>
            <Button as={Link} to="/learn" variant="secondary" size="lg">
              <BookOpen className="size-4" aria-hidden="true" />
              {isLesson ? "Lesson map" : "View course"}
            </Button>
          </div>
        </div>

        <div className="hidden items-center justify-center p-6 sm:flex" aria-hidden="true">
          {isLesson ? <LessonKeyVisual lesson={lesson} /> : <NeutralCourseVisual />}
        </div>
      </div>

      <div className="border-t border-slate-200/80 bg-white/75 px-6 py-4 backdrop-blur-sm sm:px-7 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
          <HeroMetric value={course.masteredCount} label="Lessons mastered" />
          <HeroMetric value={`${course.reachedCount} of ${course.total}`} label="Lessons covered" />
          <HeroMetric value={`${streak} day${streak === 1 ? "" : "s"}`} label="Current streak" icon={Flame} />
          <div className="flex items-center justify-end sm:justify-center">
            <ProgressRing value={course.percentage} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function LessonKeyVisual({ lesson }) {
  const keys = (lesson?.focusKeys ?? []).filter(Boolean).slice(0, 2);
  const displayKeys = keys.length ? keys : ["F", "J"];

  return (
    <div className="relative flex h-52 w-full items-center justify-center">
      <div className="absolute size-44 rounded-full border border-indigo-100/80 bg-white/55 shadow-[inset_0_0_45px_rgba(99,102,241,0.08)] dark:border-indigo-500/10 dark:bg-slate-900/25" />
      <div className="relative flex items-center gap-4">
        {displayKeys.map((key, index) => (
          <div key={`${key}-${index}`} className="relative">
            <div className={cn(
              "grid h-[72px] place-items-center rounded-2xl border border-white bg-gradient-to-b from-white to-slate-100 font-bold uppercase text-slate-800 shadow-[0_14px_24px_-12px_rgba(51,65,85,0.35),inset_0_-3px_0_rgba(148,163,184,0.18)] ring-1 ring-slate-200/80 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-white dark:ring-slate-700",
              key === "Space" ? "w-[104px] text-sm" : "w-[72px] text-2xl",
            )}>
              {formatKeyLabel(key)}
            </div>
            <span className="absolute -bottom-9 left-1/2 h-10 w-3 -translate-x-1/2 rounded-full bg-gradient-to-b from-indigo-300 to-indigo-500 opacity-75 shadow-sm" />
            <span className="absolute -bottom-11 left-1/2 size-5 -translate-x-1/2 rounded-full bg-indigo-100 ring-4 ring-white/75 dark:bg-indigo-500/25 dark:ring-slate-900/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NeutralCourseVisual() {
  return (
    <div className="relative grid size-44 place-items-center rounded-full border border-indigo-100/80 bg-white/55 shadow-[inset_0_0_45px_rgba(99,102,241,0.08)] dark:border-indigo-500/10 dark:bg-slate-900/25">
      <span className="grid size-20 place-items-center rounded-3xl border border-white bg-gradient-to-b from-white to-slate-100 text-indigo-600 shadow-[0_14px_24px_-12px_rgba(51,65,85,0.28)] ring-1 ring-slate-200/80 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-indigo-300 dark:ring-slate-700">
        <Keyboard className="size-9" />
      </span>
    </div>
  );
}

function ReviewCard({ review, dueCount }) {
  if (!review) {
    return (
      <Card as="section" aria-labelledby="review-card-title" className="flex min-h-[315px] flex-col overflow-hidden">
        <div className="flex flex-1 flex-col p-6 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <span className="grid size-7 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <RefreshCw className="size-4" aria-hidden="true" />
              </span>
              Reviews
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Caught up</span>
          </div>
          <div className="my-auto py-8">
            <span className="grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="size-7" aria-hidden="true" />
            </span>
            <h2 id="review-card-title" className="mt-5 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">No review due</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
              Keep moving through the course. A short retention check will appear here when a mastered lesson is ready to review.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      as="section"
      aria-labelledby="review-card-title"
      className="relative isolate flex min-h-[315px] flex-col overflow-hidden border-rose-200/80 shadow-[0_18px_45px_-34px_rgba(244,63,94,0.35)] dark:border-rose-500/20"
    >
      <div className="pointer-events-none absolute -right-16 top-20 -z-10 size-52 rounded-full bg-rose-100/65 blur-3xl dark:bg-rose-500/10" />
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-600 dark:text-rose-300">
            <span className="grid size-7 place-items-center rounded-lg bg-rose-50 dark:bg-rose-500/10">
              <RefreshCw className="size-4" aria-hidden="true" />
            </span>
            Review due
          </div>
          <span className="rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {dueCount} due
          </span>
        </div>

        <span className="pointer-events-none absolute right-6 top-[108px] hidden size-24 place-items-center rounded-full bg-rose-50/90 text-rose-500 ring-1 ring-rose-100 xl:grid dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/15" aria-hidden="true">
          <RefreshCw className="size-10" />
        </span>

        <h2 id="review-card-title" className="mt-5 max-w-[240px] text-3xl font-semibold tracking-[-0.035em] text-slate-950 dark:text-white">
          {review.lesson?.title || "Earlier lesson"}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          <span>About 2 minutes</span>
          <span aria-hidden="true">•</span>
          <span>Retention check</span>
        </div>

        <div className="mt-5 max-w-[300px] rounded-2xl border border-rose-100/80 bg-rose-50/70 p-4 text-sm leading-6 text-slate-600 dark:border-rose-500/15 dark:bg-rose-500/[0.06] dark:text-slate-300">
          Keep this mastered movement strong. Reviews support your course progress; they do not replace your current lesson.
        </div>

        <div className="mt-auto pt-6">
          <Button as={Link} to={`/review/${review.lessonId}`} className="bg-rose-600 shadow-rose-600/20 hover:bg-rose-500 active:bg-rose-700" size="lg">
            <Play className="size-4" aria-hidden="true" />
            Start review
          </Button>
        </div>
      </div>
    </Card>
  );
}

function QuickAction({ to, state, icon: Icon, tone, title, description }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300",
    blue: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
  };

  return (
    <Link
      to={to}
      state={state}
      className="group flex min-h-[104px] items-center gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_12px_28px_-20px_rgba(15,23,42,0.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 sm:p-5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/30"
    >
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", tones[tone])}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-indigo-500 dark:text-slate-600" aria-hidden="true" />
    </Link>
  );
}

function TodayGlance({ minutes, goalMinutes, sessions, accuracy, streak, goalComplete }) {
  const accuracyLabel = accuracy > 0 ? `${Math.round(accuracy)}%` : "—";

  return (
    <Card as="section" aria-labelledby="today-glance-title" className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Target className="size-5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
        <h2 id="today-glance-title" className="text-base font-semibold text-slate-950 dark:text-white">Today at a glance</h2>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <GlanceMetric
          icon={Clock3}
          tone="emerald"
          value={<>{minutes}<span className="ml-1 text-xs font-medium text-slate-400">/ {goalMinutes} min</span></>}
          label="Daily goal"
          badge={goalComplete ? "Completed" : getPlanCompletionLabel({ completedMinutes: minutes, goalMinutes })}
        />
        <GlanceMetric icon={Keyboard} tone="blue" value={sessions} label="Sessions today" />
        <GlanceMetric icon={Target} tone="indigo" value={accuracyLabel} label="Avg. accuracy today" />
        <GlanceMetric icon={Flame} tone="orange" value={`${streak} day${streak === 1 ? "" : "s"}`} label="Current streak" />
      </div>
    </Card>
  );
}

function GlanceMetric({ icon: Icon, tone, value, label, badge }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    blue: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300",
  };

  return (
    <div className="min-w-0 rounded-2xl bg-slate-50/70 p-3 sm:bg-transparent sm:p-0 dark:bg-slate-950/30 sm:dark:bg-transparent">
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tones[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-6 text-slate-950 dark:text-white">{value}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{label}</p>
          {badge && (
            <span className={cn(
              "mt-1.5 inline-flex max-w-full rounded-full px-2 py-0.5 text-[10px] font-semibold",
              badge === "Completed"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
            )}>
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StreakCalendar({ dailyActivity = {} }) {
  const days = getRecentCalendarDays(14);
  const todayKey = getLocalDateKey();
  const activeDays = days.filter((day) => Number(dailyActivity?.[day.key]?.seconds) > 0).length;

  return (
    <Card as="section" aria-labelledby="streak-calendar-title" className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <h2 id="streak-calendar-title" className="text-base font-semibold text-slate-950 dark:text-white">Streak calendar</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {activeDays > 0 ? `${activeDays} active day${activeDays === 1 ? "" : "s"} in the last two weeks.` : "Your recent practice days will appear here. Consistency builds mastery."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2" aria-label="Last 14 days of practice">
        {days.map((day) => {
          const active = Number(dailyActivity?.[day.key]?.seconds) > 0;
          const current = day.key === todayKey;
          return (
            <div key={day.key} className="text-center">
              <p className="text-[10px] font-semibold uppercase text-slate-400">{day.weekday}</p>
              <span
                className={cn(
                  "mx-auto mt-1.5 grid size-8 place-items-center rounded-full border text-xs font-semibold",
                  active && "border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200",
                  !active && "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
                  current && !active && "border-indigo-300 text-indigo-600 dark:border-indigo-500/50 dark:text-indigo-300",
                )}
                title={`${day.label}${active ? " · practised" : ""}${current ? " · today" : ""}`}
              >
                {day.date}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function HeroMetric({ value, label, icon: Icon }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-lg font-semibold text-slate-950 dark:text-white">
        {Icon && <Icon className="size-4 text-orange-500" aria-hidden="true" />}
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{label}</p>
    </div>
  );
}

function ProgressRing({ value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="relative size-14" role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safeValue)}>
      <svg className="size-14 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-indigo-100 dark:text-slate-800" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-indigo-600 transition-[stroke-dashoffset] duration-500 dark:text-indigo-400"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold text-slate-800 dark:text-slate-100">{Math.round(safeValue)}%</span>
    </div>
  );
}

function getRecentCalendarDays(count) {
  const days = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (count - 1));

  for (let index = 0; index < count; index += 1) {
    const date = new Date(cursor);
    days.push({
      key: getLocalDateKey(date),
      date: date.getDate(),
      weekday: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function formatKeyLabel(key) {
  if (key === "Space" || key === " ") return "Space";
  if (key === "Shift") return "⇧";
  return String(key).toUpperCase();
}
