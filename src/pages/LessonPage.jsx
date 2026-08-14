import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  RefreshCcw,
  SlidersHorizontal,
  Repeat2,
  Timer,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { TypingWorkspace } from "@/components/typing/TypingWorkspace";
import { useApp } from "@/hooks/useApp";
import {
  getLessonById,
  getNextLesson,
} from "@/data/curriculum";
import {
  assessGuidedAttempt,
  finaliseLessonMastery,
  getGuidedExerciseRequirements,
  isAdaptiveLessonUnlocked,
  MASTERY_RULE_VERSION,
  MASTERY_STATES,
} from "@/lib/adaptiveLearning";
import { generateGuidedLessonExercise, generatePracticeSession } from "@/data/contentBank";
import { buildRecoveryConfig } from "@/lib/practiceRecipes";
import { buildSessionComparison, getLessonMasteryBlockers, summariseMasteryBlockers } from "@/lib/resultCoaching";
import { cn } from "@/lib/utils";

const practiceModes = [
  { value: "guided", label: "Guided" },
  { value: "longer", label: "Longer text" },
  { value: "timed", label: "Timed" },
];
const EMPTY_MASTERY = Object.freeze({});

function getPassedExerciseIndexes(lesson, mastery = {}, completed = false) {
  if (!lesson) return [];
  const source = completed ? mastery.reviewExerciseResults : mastery.exerciseResults;
  return lesson.exercises
    .map((item, index) => source?.[item.id]?.passed ? index : null)
    .filter((index) => index !== null);
}

function getNextExerciseIndex(lesson, passedIndexes = []) {
  if (!lesson) return 0;
  return lesson.exercises.findIndex((_, index) => !passedIndexes.includes(index)) >= 0
    ? lesson.exercises.findIndex((_, index) => !passedIndexes.includes(index))
    : 0;
}

export function LessonPage() {
  const { lessonId } = useParams();
  return <LessonPageContent key={lessonId} lessonId={lessonId} />;
}

function LessonPageContent({ lessonId }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, recordSession, completeLesson } = useApp();
  const lesson = getLessonById(lessonId);
  const nextLesson = lesson ? getNextLesson(lesson.id) : null;
  const unlocked = lesson ? isAdaptiveLessonUnlocked(lesson.id, data) : false;
  const alreadyComplete = lesson ? data.progress.completedLessons.includes(lesson.id) : false;
  const currentMastery = useMemo(
    () => lesson ? data.progress.lessonMastery[lesson.id] ?? EMPTY_MASTERY : EMPTY_MASTERY,
    [data.progress.lessonMastery, lesson],
  );
  // A completed lesson can still be revisited for practice, but it no longer counts
  // as spaced-review evidence. Dedicated retention checks live under /review/:lessonId.
  const reviewAttempt = false;
  const restoredSession = location.state?.lessonSession ?? null;
  const remediation = location.state?.remediation ?? null;

  const initialPassedExercises = getPassedExerciseIndexes(lesson, currentMastery, alreadyComplete);
  const [exerciseIndex, setExerciseIndex] = useState(() => restoredSession
    ? Math.min(Math.max(0, Number(restoredSession.exerciseIndex) || 0), Math.max(0, (lesson?.exercises.length ?? 1) - 1))
    : getNextExerciseIndex(lesson, initialPassedExercises));
  const [passedExercises, setPassedExercises] = useState(initialPassedExercises);
  const [practiceMode, setPracticeMode] = useState(restoredSession?.practiceMode ?? "guided");
  const [wordCount, setWordCount] = useState(restoredSession?.wordCount ?? 100);
  const [durationSeconds, setDurationSeconds] = useState(restoredSession?.durationSeconds ?? 180);
  const [seed, setSeed] = useState(Date.now());
  const [lessonFinished, setLessonFinished] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [comparison, setComparison] = useState(null);

  const masteryBlockers = getLessonMasteryBlockers(currentMastery, lesson, { review: reviewAttempt });
  const masterySummary = summariseMasteryBlockers(masteryBlockers);
  const exercise = lesson?.exercises[exerciseIndex];
  const guidedRequirements = lesson && exercise ? getGuidedExerciseRequirements(lesson, exercise) : null;

  const generatedSession = useMemo(() => {
    if (!lesson || !exercise) return { text: "", metadata: {} };
    if (practiceMode === "guided") {
      return generateGuidedLessonExercise({
        lessonId: lesson.id,
        exerciseId: exercise.id,
        seed,
      });
    }
    return generatePracticeSession({
      contentType: "lesson",
      lessonId: lesson.id,
      goalType: practiceMode === "timed" ? "time" : "words",
      durationSeconds,
      wordCount,
      seed,
    });
  }, [durationSeconds, exercise, lesson, practiceMode, seed, wordCount]);

  const target = generatedSession.text;
  const sessionDuration = practiceMode === "timed" ? durationSeconds : null;
  const requireComplete = practiceMode !== "timed";

  const withGuidedEvidence = useCallback((result) => ({
    ...result,
    masteryRuleVersion: MASTERY_RULE_VERSION,
    curriculumVersion: lesson?.curriculumVersion,
    contentVersion: exercise?.contentVersion,
    guidedStage: exercise?.stage,
    unseenTransfer: exercise?.stage === "transfer",
    reviewScope: generatedSession.metadata?.reviewScope,
    checkpointModuleId: generatedSession.metadata?.checkpointModuleId,
    contentFingerprint: generatedSession.metadata?.fingerprint,
  }), [exercise, generatedSession.metadata, lesson?.curriculumVersion]);

  const guidedResultPasses = useCallback((result) => {
    if (!lesson || !exercise) return false;
    return assessGuidedAttempt(withGuidedEvidence(result), lesson, exercise, {
      previousMastery: currentMastery,
    }).passed;
  }, [currentMastery, exercise, lesson, withGuidedEvidence]);

  const generateFreshGuidedText = useCallback(() => {
    setLastResult(null);
    setComparison(null);
    setSeed((current) => current + 104729);
  }, []);

  const handleComplete = useCallback((result) => {
    if (!lesson || !exercise) return;
    const enrichedResult = practiceMode === "guided" ? withGuidedEvidence(result) : result;
    const accuracyTarget = practiceMode === "guided" ? guidedRequirements.accuracy : lesson.passAccuracy;
    const resultAccuracy = Number(result.keystrokeAccuracy ?? result.accuracy) || 0;
    const valid = result.validSession !== false && result.benchmarkValid !== false;
    const sessionPassed = practiceMode === "guided"
      ? assessGuidedAttempt(enrichedResult, lesson, exercise, { previousMastery: currentMastery }).passed
      : valid && resultAccuracy >= accuracyTarget && (practiceMode === "timed" || Number(result.completion) >= 99.9);
    setLastResult(result);
    const comparisonMeta = {
      type: practiceMode === "guided" ? "lesson" : "lesson-practice",
      lessonId: lesson.id,
      practiceMode,
      exerciseId: practiceMode === "guided" ? exercise.id : null,
      wordCount,
      plannedDurationSeconds: durationSeconds,
    };
    setComparison(buildSessionComparison(result, data.attempts, comparisonMeta));
    recordSession({
      ...enrichedResult,
      type: practiceMode === "guided" ? "lesson" : "lesson-practice",
      modeId: practiceMode === "guided" ? "guided-lesson" : `${practiceMode}-lesson-practice`,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      exerciseId: practiceMode === "guided" ? exercise.id : null,
      exerciseTitle: practiceMode === "guided" ? exercise.title : null,
      practiceMode,
      wordCount,
      plannedDurationSeconds: durationSeconds,
      reviewAttempt,
      accuracyTarget,
      sessionPassed,
      generatedUniqueRatio: generatedSession.metadata?.uniqueRatio,
      generatedRepeatRate: generatedSession.metadata?.repeatRate,
      remediationVersion: remediation?.version,
      remediationChainId: remediation?.chainId,
      remediationStage: remediation?.stage,
      remediationSourceType: remediation?.sourceType,
      remediationSourceId: remediation?.sourceId,
      remediationFreshText: remediation?.stage === "reassessment" ? true : undefined,
    });
  }, [currentMastery, data.attempts, durationSeconds, exercise, generatedSession.metadata, guidedRequirements, lesson, practiceMode, recordSession, remediation, reviewAttempt, withGuidedEvidence, wordCount]);

  const handleContinue = useCallback(() => {
    if (!lesson || !exercise) return;

    if (practiceMode !== "guided") {
      setLastResult(null);
      setComparison(null);
      setSeed(Date.now());
      return;
    }

    setPassedExercises((current) => current.includes(exerciseIndex) ? current : [...current, exerciseIndex]);

    if (exerciseIndex < lesson.exercises.length - 1) {
      setExerciseIndex((current) => current + 1);
      setLastResult(null);
      setComparison(null);
      setSeed(Date.now());
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const projected = finaliseLessonMastery(data.progress.lessonMastery[lesson.id] ?? {}, lesson);
    const mastered = [MASTERY_STATES.MASTERED, MASTERY_STATES.REVIEW_DUE].includes(projected.state);
    completeLesson(lesson.id);
    setLessonFinished(mastered ? "mastered" : "practice-more");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [completeLesson, data.progress.lessonMastery, exercise, exerciseIndex, lesson, practiceMode]);

  const practiseMistakes = useCallback(() => {
    if (!lastResult) return;
    navigate("/practice/session", {
      state: {
        config: {
          ...buildRecoveryConfig(lastResult, { category: "general" }, {
            sourceType: "lesson",
            sourceId: lesson.id,
            allowedCharacters: lesson.allowedCharacters,
            returnTarget: {
              kind: "lesson",
              to: `/learn/${lesson.id}`,
              label: lesson.title,
              session: { practiceMode, exerciseIndex, wordCount, durationSeconds },
            },
          }),
          seed: Date.now(),
        },
      },
    });
  }, [durationSeconds, exerciseIndex, lastResult, lesson, navigate, practiceMode, wordCount]);

  if (!lesson) {
    return <MessageCard title="Lesson not found" description="This lesson is not part of the current course." />;
  }

  if (!unlocked) {
    return (
      <MessageCard
        icon={LockKeyhole}
        title="This lesson is still locked"
        description="Complete the previous lesson with the required accuracy before continuing."
        action={<Button as={Link} to="/learn" variant="brand">Return to course</Button>}
      />
    );
  }

  if (lessonFinished) {
    const mastered = lessonFinished === "mastered";
    return (
      <section className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_50px_-36px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900">
        <div className={cn(
          "relative isolate overflow-hidden px-6 py-8 text-center sm:px-10 sm:py-10",
          mastered
            ? "bg-gradient-to-b from-emerald-50/90 to-white dark:from-emerald-500/10 dark:to-slate-900"
            : "bg-gradient-to-b from-amber-50/90 to-white dark:from-amber-500/10 dark:to-slate-900",
        )}>
          <div className={cn(
            "pointer-events-none absolute left-1/2 top-0 -z-10 h-56 w-96 -translate-x-1/2 rounded-full blur-3xl",
            mastered ? "bg-emerald-100/70 dark:bg-emerald-500/10" : "bg-amber-100/70 dark:bg-amber-500/10",
          )} />
          <span className={cn(
            "mx-auto grid size-16 place-items-center rounded-[1.35rem] border shadow-sm",
            mastered
              ? "border-emerald-200 bg-white text-emerald-600 dark:border-emerald-500/25 dark:bg-slate-900 dark:text-emerald-300"
              : "border-amber-200 bg-white text-amber-600 dark:border-amber-500/25 dark:bg-slate-900 dark:text-amber-300",
          )}>
            {mastered ? <Trophy className="size-8" /> : <RefreshCcw className="size-7" />}
          </span>
          <p className={cn(
            "mt-5 text-xs font-semibold uppercase tracking-[0.16em]",
            mastered ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
          )}>
            {mastered ? `Lesson ${lesson.number} mastered` : "Almost there"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl dark:text-white">{lesson.title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-300">
            {mastered
              ? "You completed every guided step with the required control. Your progress is saved and the course can move forward."
              : masterySummary.next?.detail || "Your work is saved, but one mastery requirement still needs a clean pass."}
          </p>

          <div className="mx-auto mt-7 grid max-w-2xl gap-2 sm:grid-cols-3" aria-label="Lesson exercise completion">
            {lesson.exercises.map((item, index) => (
              <div key={item.id} className={cn(
                "flex min-h-12 items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-semibold",
                mastered
                  ? "border-emerald-200/80 bg-white/85 text-emerald-800 dark:border-emerald-500/20 dark:bg-slate-900/80 dark:text-emerald-300"
                  : index < exerciseIndex
                    ? "border-emerald-200/80 bg-white/85 text-emerald-800 dark:border-emerald-500/20 dark:bg-slate-900/80 dark:text-emerald-300"
                    : "border-slate-200 bg-white/85 text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400",
              )}>
                <span className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-lg",
                  mastered || index < exerciseIndex
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800",
                )}>
                  {mastered || index < exerciseIndex ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className="truncate">{item.title}</span>
              </div>
            ))}
          </div>

          {mastered && (
            <div className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/75 px-4 py-3 text-left dark:border-indigo-500/20 dark:bg-indigo-500/[0.07]">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
                <RefreshCcw className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Review is handled automatically</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">This lesson will return later as a short spaced review when it is actually due.</p>
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            {mastered && nextLesson ? (
              <>
                <Button as={Link} to={`/learn/${nextLesson.id}`} variant="brand" size="lg">
                  Continue to lesson {nextLesson.number}<ArrowRight className="size-4" />
                </Button>
                <Button as={Link} to="/learn" variant="secondary" size="lg">
                  <BookOpen className="size-4" />Course map
                </Button>
              </>
            ) : (
              <>
                <Button variant="brand" size="lg" onClick={() => { setLessonFinished(null); setExerciseIndex(0); setSeed(Date.now()); }}>
                  <RefreshCcw className="size-4" />Repeat guided lesson
                </Button>
                <Button as={Link} to="/learn" variant="secondary" size="lg"><BookOpen className="size-4" />Course map</Button>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  const resetGeneratedText = () => {
    setLastResult(null);
    setComparison(null);
    setSeed(Date.now());
  };

  const guidedPassedCount = passedExercises.filter((index) => index < lesson.exercises.length).length;
  const guidedPositionPercent = Math.round(((exerciseIndex + 1) / Math.max(1, lesson.exercises.length)) * 100);

  const modeControl = (
    <SegmentedControl
      value={practiceMode}
      onChange={(value) => { setPracticeMode(value); resetGeneratedText(); }}
      options={practiceModes}
      label="Lesson practice mode"
      className="w-full rounded-xl p-1 [&>button]:min-h-10 [&>button]:flex-1 [&>button]:rounded-lg [&>button]:px-3 [&>button]:py-1.5"
    />
  );

  const practiceOptions = (
    <details className="group relative z-20">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950 marker:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {practiceMode === "guided" ? "Guided" : practiceMode === "longer" ? "Longer text" : "Timed"}
        <ChevronDown className="size-3.5 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Practice mode</p>
        <div className="mt-2">{modeControl}</div>
        {practiceMode === "guided" ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Fresh guided text</p>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-400">Same skill target, new material.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={generateFreshGuidedText}>
              <RefreshCcw className="size-3.5" />Fresh text
            </Button>
          </div>
        ) : (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {practiceMode === "longer" ? "Text length" : "Session timer"}
            </p>
            <div className="mt-2">
              {practiceMode === "longer" ? (
                <ControlGroup icon={Repeat2} label="Length">
                  {[100, 200, 300, 500].map((value) => (
                    <ChoiceButton key={value} active={wordCount === value} onClick={() => { setWordCount(value); resetGeneratedText(); }}>{value}</ChoiceButton>
                  ))}
                  <span className="text-[10px] text-slate-400">words</span>
                </ControlGroup>
              ) : (
                <ControlGroup icon={Timer} label="Timer">
                  {[60, 180, 300, 600].map((value) => (
                    <ChoiceButton key={value} active={durationSeconds === value} onClick={() => { setDurationSeconds(value); resetGeneratedText(); }}>{value / 60} min</ChoiceButton>
                  ))}
                </ControlGroup>
              )}
            </div>
            <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={resetGeneratedText}>
              <RefreshCcw className="size-3.5" />New text
            </Button>
          </div>
        )}
      </div>
    </details>
  );

  const lessonPath = (
    <div className="relative mt-5">
      <div className="pointer-events-none absolute left-[11%] right-[11%] top-9 hidden h-px bg-slate-200 sm:block dark:bg-slate-800" aria-hidden="true" />
      <div className="pointer-events-none absolute left-[11%] top-9 hidden h-px bg-gradient-to-r from-emerald-500 via-indigo-500 to-violet-500 sm:block" style={{ width: `${Math.max(0, (exerciseIndex / Math.max(1, lesson.exercises.length - 1)) * 78)}%` }} aria-hidden="true" />
      <div className="relative grid gap-3 sm:grid-cols-3" role="group" aria-label="Guided lesson steps">
        {lesson.exercises.map((item, index) => {
          const done = passedExercises.includes(index) || index < exerciseIndex;
          const active = index === exerciseIndex;
          const available = index <= exerciseIndex || passedExercises.includes(index);
          return (
            <button
              key={item.id}
              type="button"
              disabled={!available}
              aria-current={active ? "step" : undefined}
              onClick={() => {
                if (!available) return;
                setExerciseIndex(index);
                resetGeneratedText();
              }}
              className={cn(
                "relative z-10 flex min-h-[4.6rem] items-center gap-4 rounded-2xl border px-5 py-3.5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/15 disabled:cursor-not-allowed",
                active && "border-violet-500 bg-violet-50/80 shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_14px_35px_-24px_rgba(124,58,237,0.8)] dark:bg-violet-500/[0.08]",
                done && !active && "border-emerald-500/35 bg-emerald-50/55 dark:bg-emerald-500/[0.06]",
                !done && !active && "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70",
                !available && "opacity-65",
              )}
            >
              <span className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full border text-sm font-bold",
                active && "border-violet-400 bg-violet-600 text-white shadow-[0_0_24px_rgba(124,58,237,0.35)]",
                done && !active && "border-emerald-400/60 bg-emerald-500 text-white",
                !done && !active && "border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
              )}>
                {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">{item.title}</span>
                <span className={cn(
                  "mt-1 block text-xs font-medium",
                  active && "text-violet-600 dark:text-violet-300",
                  done && !active && "text-emerald-600 dark:text-emerald-300",
                  !done && !active && "text-slate-400",
                )}>
                  {done ? "Completed" : active ? "In progress" : "Upcoming"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1320px] space-y-5">
      <section aria-labelledby="lesson-focus-title" className="px-1">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Link to="/learn" className="text-violet-600 transition hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">Learn</Link>
              <ChevronRight className="size-3.5 text-slate-400" aria-hidden="true" />
              <span className="text-slate-700 dark:text-slate-200">Lesson {lesson.number}</span>
              {alreadyComplete && <span className="ml-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Mastered</span>}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 id="lesson-focus-title" className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 dark:text-white">{lesson.title}</h1>
              <span className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-violet-600/20">Lesson {lesson.number}</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{lesson.subtitle}.</p>
          </div>

          <div className="min-w-0 pb-1">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold">
              <span className="text-slate-800 dark:text-slate-100">Step {exerciseIndex + 1} of {lesson.exercises.length}</span>
              <span className="text-slate-400">{guidedPassedCount} complete</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-[width] duration-300" style={{ width: `${guidedPositionPercent}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:justify-end">
            {practiceOptions}
            <Button as={Link} to="/learn" variant="secondary" size="sm" className="min-h-11 px-4">
              <BookOpen className="size-4" />Lesson map
            </Button>
          </div>
        </div>

        {practiceMode === "guided" ? lessonPath : (
          <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/65 px-5 py-4 text-sm text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/[0.07] dark:text-violet-100">
            <span className="font-semibold">Extra lesson practice.</span> This mode strengthens {lesson.title} but does not replace the guided three-step path.
          </div>
        )}
      </section>

      <TypingWorkspace
        key={`${lesson.id}-${exerciseIndex}-${practiceMode}-${wordCount}-${durationSeconds}-${seed}`}
        layout="lesson-focus"
        sessionLabel={practiceMode === "guided" ? exercise.cumulativeReview ? "Module review check" : exercise.stage === "transfer" ? "Unseen transfer check" : `Exercise ${exerciseIndex + 1} of ${lesson.exercises.length}` : practiceMode === "timed" ? "Timed lesson practice" : "Extended lesson practice"}
        title={practiceMode === "guided" ? exercise.title : practiceMode === "timed" ? `${durationSeconds / 60}-minute ${lesson.title} practice` : `${wordCount}-word ${lesson.title} practice`}
        description={practiceMode === "guided" ? `${exercise.description}${exercise.stage === "transfer" ? " This target is freshly generated and checks independent control." : ""}` : "This text uses only keys already available in this lesson. Extra practice is saved but does not skip the guided path."}
        target={target}
        durationSeconds={sessionDuration}
        passAccuracy={practiceMode === "guided" ? guidedRequirements.accuracy : lesson.passAccuracy}
        requireComplete={requireComplete}
        showKeyboard={data.settings.showKeyboard}
        soundEnabled={data.settings.soundEnabled}
        showLiveWpm={data.settings.showLiveWpm}
        showLiveAccuracy={data.settings.showLiveAccuracy}
        autoPause={data.settings.autoPause}
        backspaceMode={data.settings.backspaceMode}
        textSize={data.settings.textSize}
        caretStyle={data.settings.caretStyle}
        lessonTip={lesson.technique}
        focusKeys={lesson.focusKeys}
        onComplete={handleComplete}
        onContinue={handleContinue}
        onResultRetry={practiceMode === "guided" ? generateFreshGuidedText : undefined}
        resultPassEvaluator={practiceMode === "guided" ? guidedResultPasses : undefined}
        continueLabel={practiceMode === "guided" ? exerciseIndex === lesson.exercises.length - 1 ? "Complete lesson" : `Continue to ${lesson.exercises[exerciseIndex + 1]?.title || "next exercise"}` : "Generate another"}
        onNewText={practiceMode === "guided" ? undefined : () => { setLastResult(null); setComparison(null); setSeed(Date.now()); }}
        newTextLabel="Fresh lesson text"
        retryLabel={practiceMode === "guided" ? "Try fresh text" : "Retry same text"}
        onPracticeMistakes={practiseMistakes}
        resultContext={practiceMode === "guided" ? {
          purpose: "guided",
          guidedStage: exercise.stage,
          focusKeys: lesson.focusKeys,
          requiresFreshRetry: true,
          lessonNumber: lesson.number,
          lessonTitle: lesson.title,
          exerciseIndex,
          totalExercises: lesson.exercises.length,
          exerciseTitle: exercise.title,
          nextExerciseTitle: lesson.exercises[exerciseIndex + 1]?.title || null,
          finalExercise: exerciseIndex === lesson.exercises.length - 1,
        } : null}
        comparison={comparison}
        masteryBlockers={practiceMode === "guided" ? masteryBlockers : []}
        showSessionNav={false}
        exitTo="/learn"
        exitLabel="Exit lesson"
      />
    </div>
  );
}

function ControlGroup({ icon: Icon, label, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"><Icon className="size-4" aria-hidden="true" />{label}</span>
      {children}
    </div>
  );
}

function ChoiceButton({ active, onClick, children }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn("rounded-xl border px-3 py-2 text-xs font-semibold transition", active ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")}>{children}</button>
  );
}


function MessageCard({ icon: Icon = LockKeyhole, title, description, action }) {
  return (
    <Card className="mx-auto max-w-2xl p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><Icon className="size-6" /></span>
      <h1 className="mt-5 text-2xl font-semibold text-slate-950 dark:text-white">{title}</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}
