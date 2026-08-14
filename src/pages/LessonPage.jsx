import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Keyboard,
  LockKeyhole,
  RefreshCcw,
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
  getPreviousLesson,
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
  const previousLesson = lesson ? getPreviousLesson(lesson.id) : null;
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
  const lessonProgressPercent = Math.round((guidedPassedCount / Math.max(1, lesson.exercises.length)) * 100);

  const modeControl = (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Mode</p>
        {practiceMode === "guided" && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">Recommended</span>
        )}
      </div>
      <SegmentedControl
        value={practiceMode}
        onChange={(value) => { setPracticeMode(value); resetGeneratedText(); }}
        options={practiceModes}
        label="Lesson practice mode"
        className="w-full rounded-xl p-1 [&>button]:min-h-10 [&>button]:flex-1 [&>button]:rounded-lg [&>button]:px-3 [&>button]:py-1.5"
      />
    </div>
  );

  const lessonPath = (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Guided lesson path</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Complete the steps in order. Your progress is saved after every valid pass.</p>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-300">{guidedPassedCount}/{lesson.exercises.length} complete</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Guided exercise">
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
                "group relative flex min-h-[4.6rem] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 disabled:cursor-not-allowed",
                active && "border-indigo-300 bg-indigo-50/90 shadow-[0_8px_24px_-20px_rgba(79,70,229,0.55)] dark:border-indigo-500/35 dark:bg-indigo-500/10",
                done && !active && "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/25 dark:bg-emerald-500/[0.07]",
                !done && !active && "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
                !available && "opacity-55",
              )}
            >
              <span className={cn(
                "grid size-8 shrink-0 place-items-center rounded-xl text-xs font-bold",
                active && "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20",
                done && !active && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                !done && !active && "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300",
              )}>
                {done ? <Check className="size-4" aria-hidden="true" /> : active ? index + 1 : <Circle className="size-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn(
                  "block text-[10px] font-semibold uppercase tracking-[0.12em]",
                  active && "text-indigo-600 dark:text-indigo-300",
                  done && !active && "text-emerald-600 dark:text-emerald-300",
                  !done && !active && "text-slate-400",
                )}>
                  {done ? "Completed" : active ? "Current step" : "Next"}
                </span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-slate-900 dark:text-white">{item.title}</span>
              </span>
              {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-indigo-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const sessionControls = practiceMode === "guided" ? (
    <div className="space-y-4">
      {lessonPath}
      <div className="grid gap-3 border-t border-slate-200/80 pt-4 lg:grid-cols-[17rem_minmax(0,1fr)_auto] lg:items-end dark:border-slate-800">
        {modeControl}
        <div className="min-w-0 rounded-2xl bg-slate-100/70 px-4 py-3 dark:bg-slate-800/55">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Current objective</p>
              <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100">{exercise.title}</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">{guidedRequirements.accuracy}% accuracy</span>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-10 w-full px-3 lg:w-auto"
          onClick={generateFreshGuidedText}
          aria-label="Generate fresh guided text"
        >
          <RefreshCcw className="size-3.5" aria-hidden="true" />Fresh text
        </Button>
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/55 px-4 py-3 text-xs leading-5 text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/[0.06] dark:text-indigo-200">
        Extra practice strengthens this lesson, but only the Guided mode advances the three-step lesson path.
      </div>
      <div className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)_auto] lg:items-end">
        {modeControl}
        <div className="min-w-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {practiceMode === "longer" ? "Text length" : "Session timer"}
          </p>
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
        <Button variant="secondary" size="sm" className="h-10 w-full px-3 lg:w-auto" onClick={resetGeneratedText}>
          <RefreshCcw className="size-3.5" aria-hidden="true" />New text
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1160px] space-y-4 sm:space-y-5">
      <Card className="relative isolate overflow-hidden border-slate-200/90 p-0 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.32)] dark:border-slate-800">
        <div className="pointer-events-none absolute -right-14 -top-20 -z-10 size-56 rounded-full bg-indigo-100/55 blur-3xl dark:bg-indigo-500/10" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link to="/learn" className="inline-flex items-center gap-1.5 font-semibold text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
                <ArrowLeft className="size-3.5" aria-hidden="true" />Course
              </Link>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">/</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-300">Lesson {lesson.number}</span>
              {alreadyComplete && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Mastered · practice revisit</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl dark:text-white">{lesson.title}</h1>
              <span className="text-sm font-medium text-slate-400">{lesson.subtitle}</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">{lesson.technique}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Clock3 className="size-3.5" />{lesson.estimatedMinutes} min</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"><Keyboard className="size-3.5" />{practiceMode === "guided" ? `Step ${exerciseIndex + 1} of ${lesson.exercises.length}` : "Extra practice"}</span>
              {practiceMode === "guided" && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="size-3.5" />{lessonProgressPercent}% path complete</span>}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
            <Button as={Link} to="/learn" variant="secondary" size="sm"><BookOpen className="size-4" />Lesson map</Button>
            <p className="px-1 text-[10px] font-medium text-slate-400 sm:self-center lg:text-center">{data.settings.backspaceMode === "disabled" ? "Backspace off" : "Backspace on"} · Esc pauses</p>
          </div>
        </div>
      </Card>

      <TypingWorkspace
        key={`${lesson.id}-${exerciseIndex}-${practiceMode}-${wordCount}-${durationSeconds}-${seed}`}
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
        sessionControls={sessionControls}
        showSessionNav={false}
        exitTo="/learn"
        exitLabel="Exit lesson"
      />

      <nav aria-label="Lesson navigation" className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        {previousLesson ? (
          <Link to={`/learn/${previousLesson.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="size-4" />Previous lesson
          </Link>
        ) : <span />}
        {alreadyComplete && nextLesson && isAdaptiveLessonUnlocked(nextLesson.id, data) ? (
          <Link to={`/learn/${nextLesson.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
            Next lesson<ArrowRight className="size-4" />
          </Link>
        ) : (
          <Link to="/learn" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
            Course map<BookOpen className="size-4" />
          </Link>
        )}
      </nav>
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
