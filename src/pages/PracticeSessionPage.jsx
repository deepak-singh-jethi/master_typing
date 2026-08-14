import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TypingWorkspace } from "@/components/typing/TypingWorkspace";
import { useApp } from "@/hooks/useApp";
import { generatePracticeSession } from "@/data/contentBank";
import { contentTypeOptions } from "@/data/practicePresets";
import {
  buildPracticeRecipe,
  buildRecoveryConfig,
  normalisePracticeConfig,
} from "@/lib/practiceRecipes";
import { getPracticeAccuracyTarget } from "@/lib/sessionRules";
import { buildSessionComparison } from "@/lib/resultCoaching";

function buildSessionState(config, data) {
  const normalised = normalisePracticeConfig({ ...config, seed: config.seed || Date.now() });
  const recipe = buildPracticeRecipe(normalised, data);
  const generated = generatePracticeSession(recipe, { recipe });
  return { config: normalised, recipe, generated };
}

function getTitle(recipe) {
  const content = contentTypeOptions.find((item) => item.value === recipe.contentType)?.label ?? "Practice";
  if (recipe.purpose === "adaptive") return "Adaptive Review";
  if (recipe.purpose === "recovery") return "Mistake Recovery";
  if (recipe.goalType === "time") return `${formatMinutes(recipe.durationSeconds)} ${content.toLowerCase()}`;
  return `${recipe.wordCount}-word ${content.toLowerCase()}`;
}

function formatMinutes(seconds) {
  const minutes = Number(seconds) / 60;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)}-minute`;
}

function getDescription(recipe) {
  if (!recipe.hasAdaptiveEvidence && ["adaptive", "recovery"].includes(recipe.purpose)) {
    return "No stable error pattern is available yet. This session creates a balanced baseline and will collect the key timing needed for future targeting.";
  }
  return recipe.summary;
}

function compactRecipeContext(recipe, metadata) {
  return {
    purpose: recipe.purpose,
    purposeLabel: recipe.purposeLabel,
    skillStage: recipe.skillStage,
    densityLabel: recipe.densityLabel,
    targetDensity: recipe.targetDensity,
    focusKeys: recipe.focusKeys,
    focusBigrams: recipe.focusBigrams,
    confusionPairs: recipe.confusionPairs,
    recoveryWords: recipe.recoveryWords,
    generatedFocusDensity: metadata.focusDensity,
    uniqueRatio: metadata.uniqueRatio,
    repeatRate: metadata.repeatRate,
    difficulty: recipe.difficulty,
    motorBand: metadata.motor?.band,
    motorScore: metadata.motor?.averageScore,
    sameFingerRatio: metadata.motor?.sameFingerRatio,
    alternationRatio: metadata.motor?.alternationRatio,
    uncommonBigramRatio: metadata.motor?.uncommonBigramRatio,
    frequencyTiers: metadata.motor?.frequencyTiers,
    featureCounts: metadata.featureCounts,
  };
}

export function PracticeSessionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, recordSession, saveLastPracticeConfig } = useApp();
  const initialConfig = location.state?.config ?? data.lastPracticeConfig;
  const [sessionState, setSessionState] = useState(() => buildSessionState(initialConfig, data));
  const [lastResult, setLastResult] = useState(null);
  const [comparison, setComparison] = useState(null);
  const { config, recipe, generated } = sessionState;

  const durationSeconds = recipe.goalType === "time" ? Number(recipe.durationSeconds) || 60 : null;
  const requireComplete = recipe.goalType === "words" || recipe.contentType === "custom";
  const passAccuracy = getPracticeAccuracyTarget(recipe);
  const resultContext = compactRecipeContext(recipe, generated.metadata);
  const recoveryContinueLabel = config.remediationReturn?.kind === "practice"
    && config.remediationReturn.config?.contentType === "custom"
    ? "Recheck original text"
    : "Check transfer on fresh text";

  useEffect(() => {
    saveLastPracticeConfig(config);
  }, [config, saveLastPracticeConfig]);

  const handleComplete = useCallback((result) => {
    const comparisonMeta = {
      type: "practice",
      modeId: recipe.contentType,
      contentType: recipe.contentType,
      practicePurpose: recipe.purpose,
      goalType: recipe.goalType,
      wordCount: recipe.wordCount,
      plannedDurationSeconds: recipe.durationSeconds,
      category: recipe.category,
      documentStyle: recipe.documentStyle,
      difficulty: recipe.difficulty,
      progressiveFeatures: recipe.progressiveFeatures,
      punctuation: recipe.punctuation,
      capitals: recipe.capitals,
      numbers: recipe.numbers,
    };
    const resultAccuracy = Number(result.keystrokeAccuracy ?? result.accuracy) || 0;
    const sessionPassed = result.validSession !== false
      && result.benchmarkValid !== false
      && resultAccuracy >= passAccuracy
      && (!requireComplete || Number(result.completion) >= 99.9);
    setLastResult(result);
    setComparison(buildSessionComparison(result, data.attempts, comparisonMeta));
    recordSession({
      ...result,
      type: "practice",
      modeId: recipe.contentType,
      contentType: recipe.contentType,
      presetId: config.presetId || null,
      practicePurpose: recipe.purpose,
      accuracyTarget: passAccuracy,
      category: recipe.category,
      difficulty: recipe.difficulty,
      progressiveFeatures: recipe.progressiveFeatures,
      punctuation: recipe.punctuation,
      capitals: recipe.capitals,
      numbers: recipe.numbers,
      goalType: recipe.goalType,
      wordCount: recipe.wordCount,
      plannedDurationSeconds: recipe.durationSeconds,
      practiceTitle: getTitle(recipe),
      sessionPassed,
      recipeVersion: recipe.recipeVersion,
      recipeSkillStage: recipe.skillStage,
      recipeDensity: recipe.targetDensity,
      recipeFocusKeys: recipe.focusKeys,
      recipeFocusBigrams: recipe.focusBigrams,
      recipeConfusionPairs: recipe.confusionPairs,
      recipeRecoveryWords: recipe.recoveryWords,
      contentFingerprint: generated.metadata.fingerprint,
      contentItems: generated.metadata.items,
      generatedFocusDensity: generated.metadata.focusDensity,
      generatedUniqueRatio: generated.metadata.uniqueRatio,
      generatedRepeatRate: generated.metadata.repeatRate,
      generatedMotorBand: generated.metadata.motor?.band,
      generatedMotorScore: generated.metadata.motor?.averageScore,
      generatedMotorProfile: generated.metadata.motor,
      generatedFeatureCounts: generated.metadata.featureCounts,
      documentStyle: recipe.documentStyle,
      remediationVersion: config.remediationVersion,
      remediationChainId: config.remediationChainId,
      remediationStage: config.remediationStage,
      remediationSourceType: config.remediationSourceType,
      remediationSourceId: config.remediationSourceId,
      remediationFreshText: config.remediationStage === "reassessment"
        ? recipe.contentType !== "custom"
        : undefined,
    });
  }, [config, data.attempts, generated.metadata, passAccuracy, recipe, recordSession, requireComplete]);

  const generateAnother = useCallback(() => {
    const nextConfig = normalisePracticeConfig({ ...config, seed: Date.now() });
    const nextState = buildSessionState(nextConfig, data);
    setSessionState(nextState);
    setLastResult(null);
    setComparison(null);
    saveLastPracticeConfig(nextConfig);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [config, data, saveLastPracticeConfig]);

  const practiseMistakes = useCallback(() => {
    if (!lastResult) return;
    const nextConfig = {
      ...buildRecoveryConfig(lastResult, config, config.remediationChainId ? {} : {
        sourceType: "practice",
        sourceId: generated.metadata.fingerprint,
      }),
      seed: Date.now(),
    };
    const nextState = buildSessionState(nextConfig, data);
    setSessionState(nextState);
    setLastResult(null);
    setComparison(null);
    saveLastPracticeConfig(nextConfig);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [config, data, generated.metadata.fingerprint, lastResult, saveLastPracticeConfig]);

  const continueAfterResult = useCallback(() => {
    if (recipe.purpose !== "recovery") {
      navigate("/practice", { state: { openBuilder: true } });
      return;
    }

    const target = config.remediationReturn;
    if (["test", "lesson", "review"].includes(target?.kind) && target.to) {
      navigate(target.to, {
        state: {
          remediation: {
            version: config.remediationVersion,
            chainId: config.remediationChainId,
            stage: "reassessment",
            sourceType: config.remediationSourceType,
            sourceId: config.remediationSourceId,
          },
          lessonSession: target.kind === "lesson" ? target.session : undefined,
        },
      });
      return;
    }

    if (target?.kind === "practice" && target.config) {
      const nextConfig = normalisePracticeConfig({
        ...target.config,
        seed: Date.now(),
        remediationVersion: config.remediationVersion,
        remediationChainId: config.remediationChainId,
        remediationStage: "reassessment",
        remediationSourceType: config.remediationSourceType,
        remediationSourceId: config.remediationSourceId,
        remediationReturn: null,
      });
      setSessionState(buildSessionState(nextConfig, data));
      setLastResult(null);
      setComparison(null);
      saveLastPracticeConfig(nextConfig);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    navigate("/practice", { state: { openBuilder: true } });
  }, [config, data, navigate, recipe.purpose, saveLastPracticeConfig]);

  return (
    <TypingWorkspace
      key={`${generated.metadata.fingerprint}-${config.seed}`}
      sessionLabel={["adaptive", "recovery"].includes(recipe.purpose) ? "Recipe-guided practice" : "Practice Studio"}
      title={getTitle(recipe)}
      description={getDescription(recipe)}
      target={generated.text}
      durationSeconds={durationSeconds}
      passAccuracy={passAccuracy}
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
      onContinue={continueAfterResult}
      continueLabel={recipe.purpose === "recovery" ? recoveryContinueLabel : "Adjust practice"}
      onNewText={recipe.contentType === "custom" ? undefined : generateAnother}
      newTextLabel="Fresh text, same recipe"
      onPracticeMistakes={practiseMistakes}
      resultContext={resultContext}
      comparison={comparison}
      exitTo="/practice"
      exitLabel="Exit practice"
    />
  );
}
