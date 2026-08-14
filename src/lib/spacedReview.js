import { generatePracticeSession } from "../data/contentBank.js";
import { getEffectiveMasteryState, MASTERY_STATES, REVIEW_INTERVALS } from "./adaptiveLearning.js";

export const SPACED_REVIEW_ENTRY_VERSION = 1;
export const SPACED_REVIEW_SESSION_VERSION = 1;
export const SPACED_REVIEW_POLICY_VERSION = 1;
export const SPACED_REVIEW_ACCURACY_TARGET = 95;
export const SPACED_REVIEW_FOCUS_ERROR_LIMIT = 8;

export const SPACED_REVIEW_STAGES = Object.freeze([
  {
    id: "cold-recall",
    label: "Cold recall",
    durationSeconds: 30,
  },
  {
    id: "fresh-transfer",
    label: "Fresh transfer",
    durationSeconds: 60,
  },
]);

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normaliseSeed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  const integer = Math.abs(Math.trunc(number)) % 2147483647;
  return integer || 1;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return normaliseSeed(hash >>> 0);
}

function seededRandom(seed) {
  let value = normaliseSeed(seed);
  return () => {
    value = (value * 48271) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}


function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, number(value)));
}

function addDays(value, days) {
  const date = value instanceof Date ? new Date(value) : new Date(value || Date.now());
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function nextReviewIntervalDays(currentDays = 0) {
  const current = Math.max(0, number(currentDays));
  if (current <= 0) return REVIEW_INTERVALS[0];
  const currentIndex = REVIEW_INTERVALS.findIndex((days) => days >= current);
  if (currentIndex < 0) return REVIEW_INTERVALS.at(-1);
  return REVIEW_INTERVALS[Math.min(REVIEW_INTERVALS.length - 1, currentIndex + 1)];
}

function mergeConfusionMatrix(first = {}, second = {}) {
  const output = {};
  for (const source of [first, second]) {
    Object.entries(source ?? {}).forEach(([expected, actuals]) => {
      const target = output[expected] ?? {};
      Object.entries(actuals ?? {}).forEach(([actual, count]) => {
        target[actual] = (number(target[actual]) || 0) + Math.max(0, number(count));
      });
      if (Object.keys(target).length) output[expected] = target;
    });
  }
  return output;
}

function mergeTimingStats(first = {}, second = {}) {
  const output = {};
  const keys = new Set([...Object.keys(first ?? {}), ...Object.keys(second ?? {})]);
  keys.forEach((key) => {
    const a = first?.[key] ?? {};
    const b = second?.[key] ?? {};
    const aFastest = a.fastestMs == null ? null : number(a.fastestMs, null);
    const bFastest = b.fastestMs == null ? null : number(b.fastestMs, null);
    const aSlowest = a.slowestMs == null ? null : number(a.slowestMs, null);
    const bSlowest = b.slowestMs == null ? null : number(b.slowestMs, null);
    output[key] = {
      attempts: number(a.attempts) + number(b.attempts),
      correct: number(a.correct) + number(b.correct),
      errors: number(a.errors) + number(b.errors),
      correctedErrors: number(a.correctedErrors) + number(b.correctedErrors),
      timedAttempts: number(a.timedAttempts) + number(b.timedAttempts),
      totalLatencyMs: number(a.totalLatencyMs) + number(b.totalLatencyMs),
      fastestMs: [aFastest, bFastest].filter((item) => item != null).length
        ? Math.min(...[aFastest, bFastest].filter((item) => item != null))
        : null,
      slowestMs: [aSlowest, bSlowest].filter((item) => item != null).length
        ? Math.max(...[aSlowest, bSlowest].filter((item) => item != null))
        : null,
      confusions: mergeConfusionMatrix(a.confusions, b.confusions),
    };
  });
  return output;
}

function mergeMistakeWords(results = []) {
  const seen = new Set();
  const output = [];
  results.forEach((result) => {
    (result?.mistakeWords ?? []).forEach((item) => {
      const expected = String(typeof item === "string" ? item : item?.expected ?? "").trim();
      if (!expected) return;
      const typed = typeof item === "string" ? "" : String(item?.typed ?? "");
      const key = `${expected}\u0000${typed}`;
      if (seen.has(key)) return;
      seen.add(key);
      output.push({ expected, typed: typed || "(missed)" });
    });
  });
  return output.slice(0, 16);
}

function difficultFromStats(stats = {}, limit = 8) {
  return Object.entries(stats)
    .map(([key, stat]) => {
      const attempts = number(stat?.attempts);
      const errors = number(stat?.errors);
      const timedAttempts = number(stat?.timedAttempts);
      return {
        key,
        attempts,
        errors,
        errorRate: attempts ? (errors / attempts) * 100 : 0,
        averageLatencyMs: timedAttempts ? number(stat?.totalLatencyMs) / timedAttempts : null,
      };
    })
    .filter((item) => item.errors > 0)
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
    .slice(0, limit);
}

function getFocusTargets(lesson) {
  const raw = lesson?.coverageTargets?.length ? lesson.coverageTargets : lesson?.focusKeys ?? [];
  return unique(raw.map((target) => target === "Space" ? " " : String(target || "")).filter(Boolean));
}

function getFocusErrorRate(lesson, keyStats = {}, bigramStats = {}) {
  const targets = getFocusTargets(lesson);
  let attempts = 0;
  let errors = 0;

  targets.forEach((target) => {
    if (target === "Shift") {
      Object.entries(keyStats).forEach(([key, stat]) => {
        if (!/^[A-Z]$/.test(key)) return;
        attempts += number(stat?.attempts);
        errors += number(stat?.errors);
      });
      return;
    }

    const stat = target.length === 2 ? bigramStats[target] : target.length === 1 ? keyStats[target] : null;
    if (!stat) return;
    attempts += number(stat.attempts);
    errors += number(stat.errors);
  });

  return attempts > 0 ? (errors / attempts) * 100 : null;
}

function weightedAverage(results = [], field, weightField) {
  let total = 0;
  let weight = 0;
  results.forEach((result) => {
    const currentWeight = Math.max(0, number(result?.[weightField]));
    if (!currentWeight) return;
    total += number(result?.[field]) * currentWeight;
    weight += currentWeight;
  });
  if (weight > 0) return total / weight;
  return results.length ? results.reduce((sum, result) => sum + number(result?.[field]), 0) / results.length : 0;
}

function compactConfusionMatrix(matrix = {}, limit = 8) {
  const rows = Object.entries(matrix)
    .flatMap(([expected, actuals]) => Object.entries(actuals ?? {}).map(([actual, count]) => ({ expected, actual, count: number(count) })))
    .filter((item) => item.expected && item.actual && item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  const output = {};
  rows.forEach(({ expected, actual, count }) => {
    output[expected] ??= {};
    output[expected][actual] = count;
  });
  return output;
}

function usesOnlyAllowedCharacters(value, allowedCharacters) {
  if (!allowedCharacters) return false;
  const allowed = new Set([...allowedCharacters]);
  return [...String(value ?? "")].every((character) => allowed.has(character));
}

function safeReviewTokens(lesson, exercise = null, options = {}) {
  const exerciseTokens = String(exercise?.target || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const focusTokens = (lesson.focusKeys ?? [])
    .flatMap((key) => {
      if (key === "Space" || key === "Shift") return [];
      const value = String(key || "");
      return value ? [value] : [];
    });
  const practiceTokens = lesson.practiceTokens ?? [];
  const primary = unique([
    ...exerciseTokens,
    ...focusTokens,
    ...(options.includePracticeTokens ? practiceTokens : []),
  ])
    .map((token) => String(token))
    .filter((token) => token && usesOnlyAllowedCharacters(token, lesson.allowedCharacters));

  if (primary.length >= 2 || options.includePracticeTokens) return primary;

  const expanded = unique([...primary, ...practiceTokens])
    .map((token) => String(token))
    .filter((token) => token && usesOnlyAllowedCharacters(token, lesson.allowedCharacters));
  if (expanded.length) return expanded;

  return [...lesson.allowedCharacters]
    .filter((character) => character !== " ")
    .map((character) => String(character));
}

function buildColdRecallText(lesson, seed, durationSeconds) {
  const focusExercise = lesson.exercises?.find((exercise) => exercise.stage === "focus")
    ?? lesson.exercises?.[0]
    ?? null;
  const tokens = safeReviewTokens(lesson, focusExercise);
  if (!tokens.length) return "";

  const random = seededRandom(seed);
  const targetCharacters = Math.max(540, Math.round(durationSeconds * 18));
  const output = [];
  let characters = 0;
  let previous = "";
  let cycle = [];

  const refillCycle = () => {
    cycle = [...tokens];
    for (let index = cycle.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [cycle[index], cycle[swap]] = [cycle[swap], cycle[index]];
    }
    if (cycle.length > 1 && cycle[0] === previous) {
      const swapIndex = 1 + Math.floor(random() * (cycle.length - 1));
      [cycle[0], cycle[swapIndex]] = [cycle[swapIndex], cycle[0]];
    }
  };

  while (characters < targetCharacters) {
    if (!cycle.length) refillCycle();
    const token = cycle.shift() || tokens[0];
    output.push(token);
    characters += token.length + (output.length > 1 ? 1 : 0);
    previous = token;
  }

  return output.join(" ");
}

function getReviewFocusRecipe(lesson) {
  const focusKeys = [];
  const focusBigrams = [];
  const focusPatterns = [];

  (lesson.coverageTargets ?? lesson.focusKeys ?? []).forEach((target) => {
    if (target === "Space") return;
    const value = String(target || "");
    if (!value) return;
    if (value.length === 1) focusKeys.push(value);
    else if (value.length === 2) focusBigrams.push(value);
    else focusPatterns.push(value);
  });

  return {
    focusKeys: unique(focusKeys),
    focusBigrams: unique(focusBigrams),
    focusPatterns: unique(focusPatterns),
  };
}

function buildFreshTransfer(lesson, seed, durationSeconds) {
  const focus = getReviewFocusRecipe(lesson);
  const recipe = {
    purpose: "spaced-review",
    contentType: "lesson",
    lessonId: lesson.id,
    goalType: "time",
    durationSeconds,
    ...focus,
    targetDensity: lesson.number <= 3 ? 0.5 : 0.34,
    reviewScope: "lesson",
    curriculumVersion: lesson.curriculumVersion,
    seed,
  };
  return generatePracticeSession(recipe, { recipe });
}

function buildSafeFallbackText(lesson, durationSeconds, seed) {
  const tokens = safeReviewTokens(lesson, null, { includePracticeTokens: true });
  if (!tokens.length) return "";
  const random = seededRandom(seed);
  const targetCharacters = Math.max(420, Math.round(durationSeconds * 14));
  const output = [];
  let characters = 0;
  let previous = "";

  while (characters < targetCharacters) {
    let candidates = tokens.filter((token) => token !== previous);
    if (!candidates.length) candidates = tokens;
    const token = candidates[Math.floor(random() * candidates.length)] || tokens[0];
    output.push(token);
    characters += token.length + (output.length > 1 ? 1 : 0);
    previous = token;
  }
  return output.join(" ");
}

export function getSpacedReviewSessionSeed({ lesson, mastery = {} } = {}) {
  if (!lesson) return 1;
  return hashSeed([
    lesson.id,
    toIsoOrNull(mastery.dueAt) ?? "no-due-date",
    Math.max(0, Number(mastery.reviewCount) || 0),
    Math.max(0, Number(mastery.reviewIntervalDays) || 0),
    SPACED_REVIEW_SESSION_VERSION,
  ].join("|"));
}

export function buildSpacedReviewSessionPlan({ lesson, mastery = {}, seed = null, variantKey = null } = {}) {
  if (!lesson) {
    return {
      version: SPACED_REVIEW_SESSION_VERSION,
      kind: "spaced-review-session",
      lessonId: null,
      stages: [],
      totalDurationSeconds: 0,
    };
  }

  const cycleSeed = normaliseSeed(seed ?? getSpacedReviewSessionSeed({ lesson, mastery }));
  const baseSeed = variantKey
    ? hashSeed(`${cycleSeed}|variant|${String(variantKey).slice(0, 120)}`)
    : cycleSeed;
  const coldRecallDefinition = SPACED_REVIEW_STAGES[0];
  const transferDefinition = SPACED_REVIEW_STAGES[1];
  const coldRecallText = buildColdRecallText(
    lesson,
    baseSeed + 101,
    coldRecallDefinition.durationSeconds,
  );
  let transfer = buildFreshTransfer(
    lesson,
    baseSeed + 2003,
    transferDefinition.durationSeconds,
  );

  if (!usesOnlyAllowedCharacters(transfer.text, lesson.allowedCharacters)) {
    const fallbackText = buildSafeFallbackText(
      lesson,
      transferDefinition.durationSeconds,
      baseSeed + 7919,
    );
    transfer = {
      text: fallbackText,
      metadata: {
        ...transfer.metadata,
        fingerprint: hashSeed(fallbackText).toString(16),
        items: unique(fallbackText.split(/\s+/).filter(Boolean)).slice(0, 80),
        reviewFallback: true,
      },
    };
  }

  const coldRecall = {
    id: coldRecallDefinition.id,
    label: coldRecallDefinition.label,
    title: "Cold recall",
    description: "Type from memory before any reteaching. Settle on the learned finger position and keep the movement light; accuracy comes before pace.",
    durationSeconds: coldRecallDefinition.durationSeconds,
    target: coldRecallText,
    fingerprint: hashSeed(coldRecallText).toString(16),
    focusKeys: [...(lesson.focusKeys ?? [])],
    transferMode: "movement",
  };

  const freshTransfer = {
    id: transferDefinition.id,
    label: transferDefinition.label,
    title: "Fresh transfer",
    description: lesson.number >= 4
      ? "Use fresh curriculum-safe material to check whether the learned movement still works beyond the first recall pattern."
      : "These early lessons do not yet have enough keys for natural words, so the transfer check uses a fresh mixed pattern made only from learned keys.",
    durationSeconds: transferDefinition.durationSeconds,
    target: transfer.text,
    fingerprint: transfer.metadata?.fingerprint ?? hashSeed(transfer.text).toString(16),
    focusKeys: [...(lesson.focusKeys ?? [])],
    transferMode: lesson.number >= 4 ? "fresh-context" : "mixed-control",
    metadata: transfer.metadata,
  };

  return {
    version: SPACED_REVIEW_SESSION_VERSION,
    kind: "spaced-review-session",
    sourceType: "lesson",
    sourceId: lesson.id,
    lessonId: lesson.id,
    lessonNumber: lesson.number,
    lessonTitle: lesson.title,
    allowedCharacters: lesson.allowedCharacters,
    focusKeys: [...(lesson.focusKeys ?? [])],
    seed: baseSeed,
    stages: [coldRecall, freshTransfer],
    totalDurationSeconds: coldRecall.durationSeconds + freshTransfer.durationSeconds,
  };
}


export function getSpacedReviewCycleId({ lesson, mastery = {} } = {}) {
  if (!lesson) return null;
  return `review-${hashSeed([
    lesson.id,
    toIsoOrNull(mastery.dueAt) ?? "no-due-date",
    Math.max(0, number(mastery.reviewCount)),
    Math.max(0, number(mastery.reviewIntervalDays)),
    SPACED_REVIEW_SESSION_VERSION,
  ].join("|")).toString(16)}`;
}

export function buildSpacedReviewEvidence({
  lesson,
  mastery = {},
  plan,
  stageResults = [],
  completedAt = new Date(),
  remediation = null,
} = {}) {
  if (!lesson || !plan?.stages?.length) return null;

  const results = plan.stages.map((stage, index) => ({ stage, result: stageResults[index] ?? null }));
  let keyStats = {};
  let bigramStats = {};
  let confusionMatrix = {};
  const rawResults = [];

  const stageEvidence = results.map(({ stage, result }) => {
    if (result) {
      rawResults.push(result);
      keyStats = mergeTimingStats(keyStats, result.keyStats ?? {});
      bigramStats = mergeTimingStats(bigramStats, result.bigramStats ?? {});
      confusionMatrix = mergeConfusionMatrix(confusionMatrix, result.confusionMatrix ?? {});
    }
    const accuracy = clamp(result?.keystrokeAccuracy ?? result?.accuracy, 0, 100);
    const durationSeconds = Math.max(0, number(result?.durationSeconds));
    const minimumCharacters = stage.id === "cold-recall" ? 10 : 20;
    const charactersTyped = Math.max(0, number(result?.characterInputs, number(result?.charactersTyped)));
    const valid = Boolean(result)
      && result.validSession !== false
      && result.benchmarkValid !== false;
    const fullDuration = Boolean(result)
      && result.reason === "time"
      && durationSeconds >= Math.max(0, stage.durationSeconds - 0.75);
    const enoughCharacters = charactersTyped >= minimumCharacters;
    const accuracyMet = accuracy >= SPACED_REVIEW_ACCURACY_TARGET;
    return {
      stageId: stage.id,
      label: stage.label,
      fingerprint: stage.fingerprint,
      plannedDurationSeconds: stage.durationSeconds,
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      charactersTyped: Math.round(charactersTyped),
      accuracy: Math.round(accuracy * 10) / 10,
      netWpm: Math.round(Math.max(0, number(result?.netWpm)) * 10) / 10,
      consistency: Math.round(clamp(result?.consistency, 0, 100)),
      valid,
      fullDuration,
      enoughCharacters,
      accuracyMet,
      passed: valid && fullDuration && enoughCharacters && accuracyMet,
    };
  });

  const focusErrorRate = getFocusErrorRate(lesson, keyStats, bigramStats);
  const focusControlled = focusErrorRate == null || focusErrorRate <= SPACED_REVIEW_FOCUS_ERROR_LIMIT;
  const reasons = [];
  stageEvidence.forEach((stage) => {
    if (!stage.valid) reasons.push(`${stage.stageId}:invalid`);
    else if (!stage.fullDuration) reasons.push(`${stage.stageId}:duration`);
    else if (!stage.enoughCharacters) reasons.push(`${stage.stageId}:too-little-evidence`);
    if (!stage.accuracyMet) reasons.push(`${stage.stageId}:accuracy`);
  });
  if (!focusControlled) reasons.push("focus-control");

  const sessionPassed = reasons.length === 0;
  const totalDurationSeconds = rawResults.reduce((sum, result) => sum + Math.max(0, number(result.durationSeconds)), 0);
  const totalCharacters = rawResults.reduce((sum, result) => sum + Math.max(0, number(result.characterInputs, number(result.charactersTyped))), 0);
  const correctCharacters = rawResults.reduce((sum, result) => sum + Math.max(0, number(result.correctCharacters)), 0);
  const characterInputs = rawResults.reduce((sum, result) => sum + Math.max(0, number(result.characterInputs, number(result.charactersTyped))), 0);
  const difficultKeys = difficultFromStats(keyStats, 8);
  const difficultBigrams = difficultFromStats(bigramStats, 6);
  const mistakeWords = mergeMistakeWords(rawResults);
  const completedIso = toIsoOrNull(completedAt) ?? new Date().toISOString();
  const reviewCycleId = getSpacedReviewCycleId({ lesson, mastery });
  const nextInterval = sessionPassed
    ? nextReviewIntervalDays(mastery.reviewIntervalDays)
    : Math.max(0, number(mastery.reviewIntervalDays));

  return {
    type: "spaced-review",
    modeId: "spaced-review",
    purpose: "spaced-review",
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    reviewAttempt: true,
    reviewScope: "retention",
    reviewPolicyVersion: SPACED_REVIEW_POLICY_VERSION,
    reviewSessionVersion: plan.version,
    reviewCycleId,
    reviewOutcome: sessionPassed ? "passed" : "needs-refresh",
    reviewAccuracyTarget: SPACED_REVIEW_ACCURACY_TARGET,
    reviewFocusErrorLimit: SPACED_REVIEW_FOCUS_ERROR_LIMIT,
    reviewFocusErrorRate: focusErrorRate == null ? null : Math.round(focusErrorRate * 10) / 10,
    reviewReasons: reasons,
    reviewStageEvidence: stageEvidence,
    reviewNextIntervalDays: nextInterval,
    sessionPassed,
    validSession: stageEvidence.every((stage) => stage.valid && stage.fullDuration && stage.enoughCharacters),
    benchmarkValid: null,
    personalBestEligible: false,
    accuracyTarget: SPACED_REVIEW_ACCURACY_TARGET,
    plannedDurationSeconds: plan.totalDurationSeconds,
    durationSeconds: Math.round(totalDurationSeconds * 10) / 10,
    activeDurationSeconds: Math.round(totalDurationSeconds * 10) / 10,
    keystrokeAccuracy: Math.round(weightedAverage(rawResults, "keystrokeAccuracy", "characterInputs") * 10) / 10,
    finalTextAccuracy: Math.round(weightedAverage(rawResults, "finalTextAccuracy", "charactersTyped") * 10) / 10,
    accuracy: Math.round(weightedAverage(rawResults, "keystrokeAccuracy", "characterInputs") * 10) / 10,
    netWpm: Math.round(weightedAverage(rawResults, "netWpm", "durationSeconds") * 10) / 10,
    rawWpm: Math.round(weightedAverage(rawResults, "rawWpm", "durationSeconds") * 10) / 10,
    consistency: Math.round(weightedAverage(rawResults, "consistency", "durationSeconds")),
    charactersTyped: Math.round(totalCharacters),
    characterInputs: Math.round(characterInputs),
    correctCharacters: Math.round(correctCharacters),
    errors: rawResults.reduce((sum, result) => sum + Math.max(0, number(result.errors, number(result.errorCount))), 0),
    correctedErrors: rawResults.reduce((sum, result) => sum + Math.max(0, number(result.correctedErrors)), 0),
    correctionActions: rawResults.reduce((sum, result) => sum + Math.max(0, number(result.correctionActions)), 0),
    pauseCount: rawResults.reduce((sum, result) => sum + Math.max(0, number(result.pauseCount)), 0),
    focusLossCount: rawResults.reduce((sum, result) => sum + Math.max(0, number(result.focusLossCount)), 0),
    completion: stageEvidence.every((stage) => stage.fullDuration) ? 100 : 0,
    reason: "review-complete",
    keyStats,
    bigramStats,
    confusionMatrix,
    mistakeWords,
    difficultKeys,
    difficultBigrams,
    focusKeys: [...(lesson.focusKeys ?? [])],
    contentFingerprint: `review:${plan.stages.map((stage) => stage.fingerprint).join(":")}`,
    completedAt: completedIso,
    remediationVersion: remediation?.version,
    remediationChainId: remediation?.chainId,
    remediationStage: remediation?.stage,
    remediationSourceType: remediation?.sourceType,
    remediationSourceId: remediation?.sourceId,
    remediationFreshText: remediation?.stage === "reassessment" ? true : undefined,
  };
}

function compactReviewEvidence(result = {}) {
  return {
    policyVersion: result.reviewPolicyVersion ?? SPACED_REVIEW_POLICY_VERSION,
    completedAt: result.completedAt ?? new Date().toISOString(),
    outcome: result.reviewOutcome ?? (result.sessionPassed ? "passed" : "needs-refresh"),
    accuracy: Math.round(clamp(result.keystrokeAccuracy ?? result.accuracy, 0, 100) * 10) / 10,
    focusErrorRate: result.reviewFocusErrorRate == null ? null : Math.round(number(result.reviewFocusErrorRate) * 10) / 10,
    reasons: Array.isArray(result.reviewReasons) ? result.reviewReasons.slice(0, 8) : [],
    stages: Array.isArray(result.reviewStageEvidence) ? result.reviewStageEvidence.slice(0, 2) : [],
    recoveryResult: {
      difficultKeys: Array.isArray(result.difficultKeys) ? result.difficultKeys.slice(0, 8) : [],
      difficultBigrams: Array.isArray(result.difficultBigrams) ? result.difficultBigrams.slice(0, 6) : [],
      mistakeWords: Array.isArray(result.mistakeWords) ? result.mistakeWords.slice(0, 12) : [],
      confusionMatrix: compactConfusionMatrix(result.confusionMatrix, 8),
    },
  };
}

export function applySpacedReviewResult(previous = {}, result = {}, lesson, now = new Date()) {
  if (!lesson || result?.type !== "spaced-review" || result.lessonId !== lesson.id) return previous;
  const effectiveState = getEffectiveMasteryState(previous, now);
  const due = Boolean(previous.masteredAt)
    && effectiveState === MASTERY_STATES.REVIEW_DUE;
  if (!due) return previous;

  const currentCycleId = getSpacedReviewCycleId({ lesson, mastery: previous });
  if (!result.reviewCycleId || result.reviewCycleId !== currentCycleId) return previous;
  if (result.sessionPassed && previous.lastCompletedReviewCycleId === currentCycleId) return previous;

  const completedAt = toIsoOrNull(result.completedAt) ?? toIsoOrNull(now) ?? new Date().toISOString();
  const evidence = compactReviewEvidence({ ...result, completedAt });
  const reviewAttempts = Math.max(0, number(previous.reviewAttempts)) + 1;

  if (!result.sessionPassed) {
    return {
      ...previous,
      state: MASTERY_STATES.REVIEW_DUE,
      dueAt: previous.dueAt || completedAt,
      reviewDueAt: previous.reviewDueAt || previous.dueAt || completedAt,
      lastPractisedAt: completedAt,
      reviewAttempts,
      lastReviewAttemptCycleId: currentCycleId,
      lastReviewOutcome: "needs-refresh",
      lastReviewEvidence: evidence,
    };
  }

  const reviewIntervalDays = nextReviewIntervalDays(previous.reviewIntervalDays);
  return {
    ...previous,
    state: MASTERY_STATES.MASTERED,
    reviewIntervalDays,
    reviewCount: Math.max(0, number(previous.reviewCount)) + 1,
    reviewAttempts,
    lastReviewedAt: completedAt,
    lastPractisedAt: completedAt,
    lastPassedAt: completedAt,
    dueAt: addDays(completedAt, reviewIntervalDays),
    reviewDueAt: addDays(completedAt, reviewIntervalDays),
    lastReviewAttemptCycleId: currentCycleId,
    lastCompletedReviewCycleId: currentCycleId,
    lastReviewOutcome: "passed",
    lastReviewEvidence: evidence,
    reviewExerciseResults: {},
    reviewCycleStartedAt: null,
  };
}

export function buildSpacedReviewEntryState({ lesson, mastery = {}, nextLesson = null, now = new Date() } = {}) {
  if (!lesson) {
    return {
      version: SPACED_REVIEW_ENTRY_VERSION,
      kind: "spaced-review",
      status: "missing",
      sourceType: "lesson",
      sourceId: null,
      canReview: false,
    };
  }

  const effectiveState = getEffectiveMasteryState(mastery, now);
  const mastered = Boolean(mastery.masteredAt)
    || [MASTERY_STATES.MASTERED, MASTERY_STATES.REVIEW_DUE].includes(effectiveState);
  const due = mastered && effectiveState === MASTERY_STATES.REVIEW_DUE;

  return {
    version: SPACED_REVIEW_ENTRY_VERSION,
    kind: "spaced-review",
    status: !mastered ? "unavailable" : due ? "due" : "scheduled",
    sourceType: "lesson",
    sourceId: lesson.id,
    lessonId: lesson.id,
    lessonNumber: lesson.number,
    lessonTitle: lesson.title,
    allowedCharacters: lesson.allowedCharacters,
    focusKeys: [...(lesson.focusKeys ?? [])],
    dueAt: toIsoOrNull(mastery.dueAt),
    lastReviewedAt: toIsoOrNull(mastery.lastReviewedAt),
    reviewCount: Math.max(0, Number(mastery.reviewCount) || 0),
    intervalDays: Math.max(0, Number(mastery.reviewIntervalDays) || 0),
    currentLesson: nextLesson
      ? {
          id: nextLesson.id,
          number: nextLesson.number,
          title: nextLesson.title,
        }
      : null,
    reviewRoute: `/review/${lesson.id}`,
    reviewSessionRoute: `/review/${lesson.id}/session`,
    lessonRoute: `/learn/${lesson.id}`,
    returnTo: "/",
    canReview: due,
  };
}
