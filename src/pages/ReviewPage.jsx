import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpenCheck, CalendarClock, Clock3, RefreshCcw } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { useApp } from "@/hooks/useApp";
import { getLessonById } from "@/data/curriculum";
import { getNextRecommendedLesson } from "@/lib/adaptiveLearning";
import { buildSpacedReviewEntryState } from "@/lib/spacedReview";

function formatDueDate(value) {
  if (!value) return "Scheduled review";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Scheduled review";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function ReviewPage() {
  const { lessonId } = useParams();
  const { data } = useApp();
  const lesson = getLessonById(lessonId);
  const mastery = lesson ? data.progress.lessonMastery?.[lesson.id] ?? {} : {};
  const nextLesson = getNextRecommendedLesson(data);
  const review = buildSpacedReviewEntryState({ lesson, mastery, nextLesson });

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
              This is maintenance, not another run through the original lesson. The dedicated review flow keeps old-skill retention separate from new-skill teaching.
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
              <p className="flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" />Designed as a short retention check</p>
              <p className="flex items-center gap-2"><BookOpenCheck className="size-4" aria-hidden="true" />Full lesson stays separate</p>
            </div>
          </div>
        </div>
      </Card>

      <Card as="section" aria-labelledby="review-session-title" className="p-6 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Review session</p>
            <h2 id="review-session-title" className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">Short retention practice belongs here</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              The review route and lesson context are now isolated from the teaching lesson. The short curriculum-safe review content is intentionally not substituted with the old three-exercise lesson flow.
            </p>
          </div>
          <Button variant="brand" size="lg" disabled aria-disabled="true">
            Start short review
          </Button>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-400">
          Review generation is not enabled in this phase, so completing the old lesson cannot accidentally count as a spaced review.
        </p>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button as={Link} to={`/learn/${lesson.id}`} variant="ghost">
          Revisit full lesson
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
