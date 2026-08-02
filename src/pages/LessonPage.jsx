import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
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
  getEffectiveMasteryState,
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
  const masteryState = getEffectiveMasteryState(currentMastery);
  const [reviewAttempt] = useState(() => alreadyComplete
    || [MASTERY_STATES.MASTERED, MASTERY_STATES.REVIEW_DUE].includes(masteryState));
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
      <section className={cn(
        "mx-auto max-w-3xl rounded-[2.25rem] border p-7 text-center sm:p-10",
        mastered
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10"
          : "border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10",
      )}>
        <span className={cn(
          "mx-auto grid size-16 place-items-center rounded-3xl",
          mastered
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        )}><Trophy className="size-8" /></span>
        <p className={cn(
          "mt-6 text-xs font-semibold uppercase tracking-[0.18em]",
          mastered ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
        )}>{mastered ? `Lesson ${lesson.number} mastered` : "One more controlled pass needed"}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{lesson.title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          {mastered
            ? "All guided movements met the mastery rule. The lesson will return later as a spaced review instead of disappearing permanently."
            : masterySummary.next?.detail || "Your exercises were saved, but at least one mastery requirement still needs work."}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button as={Link} to="/learn" variant="secondary">Course overview</Button>
          {mastered && nextLesson
            ? <Button as={Link} to={`/learn/${nextLesson.id}`} variant="brand">Next lesson<ArrowRight className="size-4" /></Button>
            : <Button variant="brand" onClick={() => { setLessonFinished(null); setExerciseIndex(0); setSeed(Date.now()); }}>Repeat lesson<RefreshCcw className="size-4" /></Button>}
        </div>
      </section>
    );
  }

  const resetGeneratedText = () => {
    setLastResult(null);
    setComparison(null);
    setSeed(Date.now());
  };

  const modeControl = (
    <div className="min-w-0">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Mode</p>
      <SegmentedControl
        value={practiceMode}
        onChange={(value) => { setPracticeMode(value); resetGeneratedText(); }}
        options={practiceModes}
        label="Lesson practice mode"
        className="w-full rounded-xl p-0.5 [&>button]:min-h-10 [&>button]:flex-1 [&>button]:rounded-[0.65rem] [&>button]:px-3 [&>button]:py-1.5"
      />
    </div>
  );

  const sessionControls = practiceMode === "guided" ? (
    <div className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)_auto] lg:items-end">
      {modeControl}

      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Exercise</p>
          <p className="text-[10px] font-medium text-slate-400">{exerciseIndex + 1} of {lesson.exercises.length}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3" role="group" aria-label="Guided exercise">
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
                  "group inline-flex h-10 min-w-[9.25rem] items-center gap-2 rounded-xl border px-3 text-left text-[11px] font-semibold transition sm:min-w-0 disabled:cursor-not-allowed disabled:opacity-45",
                  active && "border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-600/20",
                  done && !active && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
                  !done && !active && "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800",
                )}
              >
                <span className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold",
                  active && "bg-white/15 text-white",
                  done && !active && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                  !done && !active && "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300",
                )}>
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span className="min-w-0 truncate">{item.title}</span>
              </button>
            );
          })}
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
  ) : (
    <div className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)_auto] lg:items-end">
      {modeControl}
      <div className="min-w-0">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
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
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-indigo-600 dark:text-indigo-400">Lesson {lesson.number} · {lesson.subtitle}</p>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><Clock3 className="size-3.5" aria-hidden="true" />{lesson.estimatedMinutes} min</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.035em] text-slate-950 dark:text-white">{lesson.title}</h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-5 text-slate-600 dark:text-slate-400">{lesson.technique}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs font-medium text-slate-400 sm:inline">{data.settings.backspaceMode === "disabled" ? "Backspace off" : "Backspace on"} · Esc pauses</span>
            <Button as={Link} to="/learn" variant="ghost" size="sm"><ArrowLeft className="size-4" aria-hidden="true" />Exit lesson</Button>
          </div>
        </div>

      </Card>

      <TypingWorkspace
        key={`${lesson.id}-${exerciseIndex}-${practiceMode}-${wordCount}-${durationSeconds}-${seed}`}
        sessionLabel={practiceMode === "guided" ? exercise.cumulativeReview ? "Module review check" : exercise.stage === "transfer" ? "Unseen transfer check" : `Exercise ${exerciseIndex + 1} of ${lesson.exercises.length}` : practiceMode === "timed" ? "Timed lesson practice" : "Extended lesson practice"}
        title={practiceMode === "guided" ? exercise.title : practiceMode === "timed" ? `${durationSeconds / 60}-minute ${lesson.title} practice` : `${wordCount}-word ${lesson.title} practice`}
        description={practiceMode === "guided" ? `${exercise.description}${exercise.stage === "transfer" ? " This target is freshly generated and checks independent control." : ""}` : "This text is generated only from keys already available in this lesson. Extra practice is saved but does not skip the guided path."}
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
        continueLabel={practiceMode === "guided" ? exerciseIndex === lesson.exercises.length - 1 ? "Complete lesson" : "Next exercise" : "Generate another"}
        onNewText={practiceMode === "guided" ? undefined : () => { setLastResult(null); setComparison(null); setSeed(Date.now()); }}
        newTextLabel="Fresh lesson text"
        retryLabel={practiceMode === "guided" ? "Try fresh text" : "Retry same text"}
        onPracticeMistakes={practiseMistakes}
        resultContext={practiceMode === "guided" ? {
          purpose: "guided",
          guidedStage: exercise.stage,
          focusKeys: lesson.focusKeys,
          requiresFreshRetry: true,
        } : null}
        comparison={comparison}
        masteryBlockers={practiceMode === "guided" ? masteryBlockers : []}
        sessionControls={sessionControls}
        showSessionNav={false}
        exitTo="/learn"
        exitLabel="Exit lesson"
      />

      <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-5 dark:border-slate-800">
        {previousLesson ? <Link to={`/learn/${previousLesson.id}`} className="text-sm font-semibold text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">← Previous lesson</Link> : <span />}
        {nextLesson && isAdaptiveLessonUnlocked(nextLesson.id, data) && <Link to={`/learn/${nextLesson.id}`} className="text-sm font-semibold text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">Next lesson →</Link>}
      </div>
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
