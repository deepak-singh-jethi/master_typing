import { useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  Target,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { useApp } from "@/hooks/useApp";
import { getLessonById } from "@/data/curriculum";
import { getNextRecommendedLesson } from "@/lib/adaptiveLearning";
import { buildRecoveryConfig } from "@/lib/practiceRecipes";
import {
  buildSpacedReviewEntryState,
  SPACED_REVIEW_ACCURACY_TARGET,
} from "@/lib/spacedReview";

function formatDueDate(value) {
  if (!value) return "Scheduled review";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Scheduled review";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function resultAccuracy(result, evidence) {
  const value = result?.keystrokeAccuracy ?? result?.accuracy ?? evidence?.accuracy;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
}

function focusErrorRate(result, evidence) {
  const value = result?.reviewFocusErrorRate ?? evidence?.focusErrorRate;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
}

export function ReviewPage() {
  const { lessonId } = useParams();
  const location = useLocation();
  const { data } = useApp();
  const lesson = getLessonById(lessonId);
  const mastery = lesson ? data.progress.lessonMastery?.[lesson.id] ?? {} : {};
  const nextLesson = getNextRecommendedLesson(data);
  const review = buildSpacedReviewEntryState({ lesson, mastery, nextLesson });
  const navigationResult = location.state?.reviewResult ?? null;
  const lastEvidence = mastery.lastReviewEvidence ?? null;
  const outcome = navigationResult?.reviewOutcome
    ?? (review.status === "due" ? mastery.lastReviewOutcome : null);
  const recoverySource = outcome === "needs-refresh"
    ? navigationResult ?? lastEvidence?.recoveryResult ?? null
    : null;

  const retryVariant = useMemo(() => {
    if (outcome !== "needs-refresh" || !lesson) return null;
    return `retry:${lesson.id}:${mastery.lastReviewAttemptCycleId || navigationResult?.reviewCycleId || "due"}:${Date.now()}`;
  }, [lesson, mastery.lastReviewAttemptCycleId, navigationResult?.reviewCycleId, outcome]);

  const recoveryConfig = useMemo(() => {
    if (!lesson || !recoverySource) return null;
    return {
      ...buildRecoveryConfig(recoverySource, { category: "general" }, {
        sourceType: "lesson",
        sourceId: lesson.id,
        allowedCharacters: lesson.allowedCharacters,
        returnTarget: {
          kind: "review",
          to: `/review/${lesson.id}/session`,
          label: `${lesson.title} retention check`,
        },
      }),
      durationSeconds: 120,
      seed: Date.now(),
    };
  }, [lesson, recoverySource]);

  if (!lesson || review.status === "missing") {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-7 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Spaced review</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Review not found</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            This review does not match a lesson in the current course.
          </p>
          <Button as={Link} to="/" variant="brand" className="mt-7">
            <ArrowLeft className="size-4" aria-hidden="true" />Back to Today
          </Button>
        </Card>
      </div>
    );
  }

  if (review.status === "unavailable") {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-7 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Spaced review</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Master the lesson first</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Spaced review is for movements you have already mastered. Complete {lesson.title} before using its retention review.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button as={Link} to={`/learn/${lesson.id}`} variant="brand">Open lesson<ArrowRight className="size-4" aria-hidden="true" /></Button>
            <Button as={Link} to="/learn" variant="secondary">Course overview</Button>
          </div>
        </Card>
      </div>
    );
  }

  const dueNow = review.status === "due";
  const accuracy = resultAccuracy(navigationResult, lastEvidence);
  const focusError = focusErrorRate(navigationResult, lastEvidence);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="size-4" aria-hidden="true" />Today
      </Link>

      <Card as="section" aria-labelledby="review-title" className="overflow-hidden border-indigo-200 dark:border-indigo-500/30">
        <div className="grid lg:grid-cols-[1fr_250px]">
          <div className="p-7 sm:p-9">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                <RefreshCcw className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">
                  {dueNow ? "Spaced review due" : "Spaced review"}
                </p>
                <p className="mt-1 text-xs text-slate-400">Retention check · previously mastered</p>
              </div>
            </div>

            <h1 id="review-title" className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{lesson.title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              This is maintenance, not another run through the original lesson. A short cold recall and fresh transfer check decide whether this movement can move to the next review interval.
            </p>

            {review.currentLesson && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                Your course position is still <span className="font-semibold text-slate-950 dark:text-white">Lesson {review.currentLesson.number}: {review.currentLesson.title}</span>.
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50/80 p-7 lg:border-l lg:border-t-0 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Review status</p>
            <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{dueNow ? "Due now" : `Next: ${formatDueDate(review.dueAt)}`}</p>
            <div className="mt-5 space-y-3 text-xs text-slate-500 dark:text-slate-400">
              <p className="flex items-center gap-2"><CalendarClock className="size-4" aria-hidden="true" />Interval: {review.intervalDays || "—"} days</p>
              <p className="flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" />90-second retention check</p>
              <p className="flex items-center gap-2"><Target className="size-4" aria-hidden="true" />Accuracy target: {SPACED_REVIEW_ACCURACY_TARGET}%</p>
            </div>
          </div>
        </div>
      </Card>

      {outcome === "passed" && (
        <Card as="section" className="border-emerald-200 bg-emerald-50/60 p-6 dark:border-emerald-500/25 dark:bg-emerald-500/5">
          <div className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-emerald-950 dark:text-emerald-100">Movement retained</p>
              <p className="mt-1 text-sm leading-6 text-emerald-800/80 dark:text-emerald-200/80">
                The review passed. This lesson is no longer due and its next retention interval has been extended.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                {accuracy != null && <span>{accuracy}% accuracy</span>}
                {focusError != null && <span>{focusError}% target-movement error rate</span>}
                <span>Next review: {formatDueDate(review.dueAt)}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {outcome === "needs-refresh" && (
        <Card as="section" className="border-amber-200 bg-amber-50/60 p-6 dark:border-amber-500/25 dark:bg-amber-500/5">
          <div className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-950 dark:text-amber-100">Quick refresh needed</p>
              <p className="mt-1 text-sm leading-6 text-amber-800/80 dark:text-amber-200/80">
                This review stays due. Repair the movements that caused errors, then return to a fresh retention check before the interval can advance.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
                {accuracy != null && <span>{accuracy}% accuracy</span>}
                {focusError != null && <span>{focusError}% target-movement error rate</span>}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {recoveryConfig && (
                  <Button as={Link} to="/practice/session" state={{ config: recoveryConfig }} variant="brand">
                    Practice weak movements<ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                )}
                <Button as={Link} to={review.reviewSessionRoute} state={{ reviewVariant: retryVariant }} variant="secondary">
                  Retry review now
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card as="section" aria-labelledby="review-session-title" className="p-6 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Review session</p>
            <h2 id="review-session-title" className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">Cold recall, then fresh transfer</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Start with a 30-second recall check before any reteaching, then use 60 seconds of fresh curriculum-safe material. Passing requires valid full-duration evidence and clean control; speed is not a gate.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="rounded-xl bg-slate-100 px-3 py-1.5 dark:bg-slate-800">1 · Cold recall · 30 sec</span>
              <span className="rounded-xl bg-slate-100 px-3 py-1.5 dark:bg-slate-800">2 · Fresh transfer · 60 sec</span>
            </div>
          </div>
          {review.canReview ? (
            <Button
              as={Link}
              to={review.reviewSessionRoute}
              state={outcome === "needs-refresh" ? { reviewVariant: retryVariant } : undefined}
              variant="brand"
              size="lg"
            >
              Start short review<ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="brand" size="lg" disabled aria-disabled="true">
              Review not due yet
            </Button>
          )}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-400">
          A successful dedicated review advances the retention schedule once. Reopening the full lesson remains practice and does not substitute for this check.
        </p>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button as={Link} to={`/learn/${lesson.id}`} variant="ghost">
          <BookOpenCheck className="size-4" aria-hidden="true" />Revisit full lesson
        </Button>
        {review.currentLesson ? (
          <Button as={Link} to={`/learn/${review.currentLesson.id}`} variant="secondary">
            Continue {review.currentLesson.title}<ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button as={Link} to="/learn" variant="secondary">Course overview<ArrowRight className="size-4" aria-hidden="true" /></Button>
        )}
      </div>
    </div>
  );
}
