import { Link } from "react-router-dom";
import { ArrowRight, Check, CircleDot, LockKeyhole, Route } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { ProgressBar } from "@/components/common/ProgressBar";
import { useApp } from "@/hooks/useApp";
import { courseModules, getLessonsByModule } from "@/data/curriculum";
import { getCourseProgress, getLessonAdaptiveState, getNextRecommendedLesson, getPlacementCredits, isAdaptiveLessonUnlocked, MASTERY_STATES } from "@/lib/adaptiveLearning";
import { cn, percentage } from "@/lib/utils";

export function LearnPage() {
  const { data } = useApp();
  const completed = data.progress.completedLessons;
  const placementCredits = getPlacementCredits(data);
  const nextLesson = getNextRecommendedLesson(data);
  const course = getCourseProgress(data);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Course</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] text-slate-950 dark:text-white">Your learning path</h1>
          <p className="mt-2 text-base text-slate-500 dark:text-slate-400">One lesson at a time. Accuracy unlocks what comes next.</p>
        </div>
        {nextLesson && <Button as={Link} to={`/learn/${nextLesson.id}`} variant="brand" size="lg">Continue lesson {nextLesson.number}<ArrowRight className="size-4" /></Button>}
      </header>

      <Card className="p-5 sm:px-6">
        <div className="flex items-center justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">Foundation course</p>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">{Math.round(course.percentage)}%</span>
            </div>
            <ProgressBar value={course.percentage} className="mt-3" />
          </div>
          <p className="hidden shrink-0 text-xs text-slate-400 sm:block">
            {course.masteredCount} mastered{course.creditedCount > 0 ? ` · ${course.creditedCount} placement credits` : ""}
          </p>
        </div>
      </Card>

      <div className="space-y-5">
        {courseModules.map((module) => {
          const lessons = getLessonsByModule(module.id);
          const doneCount = lessons.filter((item) => completed.includes(item.id) || placementCredits.includes(item.id)).length;
          return (
            <Card as="section" key={module.id} className="overflow-hidden">
              <div className="flex items-center gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <span className={cn("grid size-9 place-items-center rounded-xl text-sm font-bold", doneCount === lessons.length ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>
                  {doneCount === lessons.length ? <Check className="size-4" /> : module.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold text-slate-950 dark:text-white">{module.title}</h2>
                    <span className="text-xs text-slate-400">{doneCount}/{lessons.length}</span>
                  </div>
                  <ProgressBar value={percentage(doneCount, lessons.length)} className="mt-2" />
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {lessons.map((lesson) => (
                  <LessonItem
                    key={lesson.id}
                    lesson={lesson}
                    complete={completed.includes(lesson.id)}
                    unlocked={isAdaptiveLessonUnlocked(lesson.id, data)}
                    current={nextLesson?.id === lesson.id}
                    state={getLessonAdaptiveState(lesson.id, data)}
                  />
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function LessonItem({ lesson, complete, unlocked, current, state }) {
  const content = (
    <div className={cn("group flex items-center gap-4 px-5 py-4 transition", unlocked && "hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5", current && "bg-indigo-50/70 dark:bg-indigo-500/5", !unlocked && "opacity-55")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold", complete ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : current ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300")}>
        {complete ? <Check className="size-4" /> : state === MASTERY_STATES.PLACEMENT_CREDIT ? <Route className="size-4" /> : !unlocked ? <LockKeyhole className="size-3.5" /> : current ? <CircleDot className="size-4" /> : lesson.number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{lesson.title}</h3>
          {current && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">NEXT</span>}
          {state === MASTERY_STATES.REVIEW_DUE && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">REVIEW</span>}
          {state === MASTERY_STATES.PLACEMENT_CREDIT && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">PLACEMENT CREDIT</span>}
        </div>
        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{lesson.subtitle}</p>
      </div>
      <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
        {lesson.focusKeys.slice(0, 6).map((key) => <kbd key={key} className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{key}</kbd>)}
      </div>
      {unlocked && <ArrowRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />}
    </div>
  );
  return unlocked ? <Link to={`/learn/${lesson.id}`}>{content}</Link> : content;
}
