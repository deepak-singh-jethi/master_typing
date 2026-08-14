import { useCallback, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Check, Circle } from "lucide-react";
import { TypingWorkspace } from "@/components/typing/TypingWorkspace";
import { getLessonById } from "@/data/curriculum";
import { useApp } from "@/hooks/useApp";
import { getNextRecommendedLesson } from "@/lib/adaptiveLearning";
import {
  buildSpacedReviewEntryState,
  buildSpacedReviewSessionPlan,
} from "@/lib/spacedReview";
import { cn } from "@/lib/utils";

const EMPTY_MASTERY = Object.freeze({});

export function ReviewSessionPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { data } = useApp();
  const lesson = getLessonById(lessonId);
  const mastery = lesson
    ? data.progress.lessonMastery?.[lesson.id] ?? EMPTY_MASTERY
    : EMPTY_MASTERY;
  const nextLesson = getNextRecommendedLesson(data);
  const entry = buildSpacedReviewEntryState({ lesson, mastery, nextLesson });
  const [stageIndex, setStageIndex] = useState(0);
  const [stageResults, setStageResults] = useState([]);

  const plan = useMemo(
    () => buildSpacedReviewSessionPlan({ lesson, mastery }),
    [lesson, mastery],
  );

  const stage = plan.stages[stageIndex] ?? null;

  const handleComplete = useCallback((result) => {
    setStageResults((current) => {
      const next = [...current];
      next[stageIndex] = {
        stageId: stage?.id ?? null,
        accuracy: Number(result.keystrokeAccuracy ?? result.accuracy) || 0,
        netWpm: Number(result.netWpm) || 0,
        consistency: Number(result.consistency) || 0,
        completion: Number(result.completion) || 0,
        valid: result.validSession !== false && result.benchmarkValid !== false,
      };
      return next;
    });
  }, [stage?.id, stageIndex]);

  const continueAfterStage = useCallback(() => {
    if (stageIndex < plan.stages.length - 1) {
      setStageIndex((current) => current + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    navigate(`/review/${lesson.id}`, {
      replace: true,
      state: {
        reviewSessionCompleted: true,
        reviewSessionVersion: plan.version,
        stageResults,
      },
    });
  }, [lesson?.id, navigate, plan.stages.length, plan.version, stageIndex, stageResults]);

  if (!lesson || entry.status === "missing") {
    return <Navigate to="/learn" replace />;
  }

  if (!entry.canReview || !stage) {
    return <Navigate to={`/review/${lesson.id}`} replace />;
  }

  const resultContext = {
    purpose: "spaced-review",
    reviewStage: stage.id,
    reviewStageLabel: stage.label,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    stageIndex,
    totalStages: plan.stages.length,
  };

  return (
    <TypingWorkspace
      key={`${lesson.id}-${stage.id}-${stage.fingerprint}`}
      sessionLabel={`Spaced review · ${stageIndex + 1} of ${plan.stages.length}`}
      title={`${stage.title} — ${lesson.title}`}
      description={stage.description}
      target={stage.target}
      durationSeconds={stage.durationSeconds}
      passAccuracy={0}
      requireComplete={false}
      resultPassEvaluator={() => true}
      showKeyboard={data.settings.showKeyboard}
      soundEnabled={data.settings.soundEnabled}
      showLiveWpm={false}
      showLiveAccuracy={data.settings.showLiveAccuracy}
      autoPause={data.settings.autoPause}
      backspaceMode={data.settings.backspaceMode}
      textSize={data.settings.textSize}
      caretStyle={data.settings.caretStyle}
      countdownSeconds={stageIndex === 0 ? 3 : 2}
      onComplete={handleComplete}
      onContinue={continueAfterStage}
      continueLabel={stageIndex < plan.stages.length - 1 ? "Continue to fresh transfer" : "Finish review practice"}
      retryLabel="Retry this stage"
      resultContext={resultContext}
      sessionControls={<ReviewStageStrip stages={plan.stages} currentIndex={stageIndex} />}
      exitTo={`/review/${lesson.id}`}
      exitLabel="Exit review"
    />
  );
}

function ReviewStageStrip({ stages, currentIndex }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2" aria-label={`Review stage ${currentIndex + 1} of ${stages.length}`}>
        {stages.map((item, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          return (
            <span
              key={item.id}
              className={cn(
                "inline-flex min-h-8 items-center gap-2 rounded-xl px-3 text-xs font-semibold",
                active && "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
                complete && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
                !active && !complete && "bg-slate-100 text-slate-400 dark:bg-slate-800/70 dark:text-slate-500",
              )}
            >
              {complete
                ? <Check className="size-3.5" aria-hidden="true" />
                : <Circle className={cn("size-3.5", active && "fill-current")} aria-hidden="true" />}
              {item.label}
            </span>
          );
        })}
      </div>
      <p className="text-[11px] font-medium text-slate-400">Accuracy first · speed is not shown live</p>
    </div>
  );
}
