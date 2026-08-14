import { lessons, getLessonById } from "../data/curriculum.js";
import { clamp } from "./number.js";

export const MASTERY_STATES = {
  LOCKED: "locked",
  LEARNING: "learning",
  PRACTISING: "practising",
  MASTERED: "mastered",
  REVIEW_DUE: "review-due",
  PLACEMENT_CREDIT: "placement-credit",
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const REVIEW_INTERVALS = Object.freeze([3, 7, 14, 30, 60]);
export const MASTERY_RULE_VERSION = 2;

function getLocalDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values = []) {
  const usable = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  if (!usable.length) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function toIso(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function addDays(value, days) {
  const date = value instanceof Date ? new Date(value) : new Date(value || Date.now());
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getResultAccuracy(result = {}) {
  return clamp(asNumber(result.keystrokeAccuracy, asNumber(result.accuracy)), 0, 100);
}

function getRequiredExerciseIds(lesson) {
  return Array.isArray(lesson?.exercises) ? lesson.exercises.map((exercise) => exercise.id) : [];
}

function normaliseFocusKeys(focusKeys = []) {
  const keys = new Set();
  focusKeys.forEach((focus) => {
    if (focus === "Shift") return;
    if (focus === "Space") {
      keys.add("Space");
      return;
    }
    for (const character of String(focus || "")) {
      if (character === " ") keys.add("Space");
      else keys.add(character.toLowerCase());
    }
  });
  return [...keys];
}

function getFocusErrorRate(result = {}, lesson = {}, exercise = {}) {
  const focusKeys = exercise.cumulativeReview && exercise.reviewTargets?.length
    ? exercise.reviewTargets
    : lesson.focusKeys;
  if (focusKeys?.includes("Shift")) {
    const capitalStats = Object.entries(result.keyStats ?? {})
      .filter(([key]) => /^[A-Z]$/.test(key))
      .map(([, stat]) => stat ?? {});
    const attempts = capitalStats.reduce((sum, stat) => sum + asNumber(stat.attempts), 0);
    const errors = capitalStats.reduce((sum, stat) => sum + asNumber(stat.errors), 0);
    if (attempts > 0) return (errors / attempts) * 100;
  }
  const normalisedKeys = normaliseFocusKeys(focusKeys);
  if (!normalisedKeys.length) return Math.max(0, 100 - getResultAccuracy(result));

  let attempts = 0;
  let errors = 0;
  normalisedKeys.forEach((key) => {
    const stat = result.keyStats?.[key] ?? result.keyStats?.[key.toUpperCase()] ?? {};
    attempts += asNumber(stat.attempts);
    errors += asNumber(stat.errors);
  });

  return attempts > 0 ? (errors / attempts) * 100 : Math.max(0, 100 - getResultAccuracy(result));
}

export function getGuidedExerciseRequirements(lesson = {}, exercise = {}) {
  const stage = exercise.stage || "control";
  const baseAccuracy = asNumber(exercise.passAccuracy, asNumber(lesson.passAccuracy, 94));
  const accuracy = stage === "focus"
    ? Math.max(96, baseAccuracy)
    : Math.max(95, baseAccuracy);
  const maximumFocusErrorRate = stage === "focus" ? 4 : stage === "control" ? 6 : 8;
  return {
    masteryRuleVersion: MASTERY_RULE_VERSION,
    stage,
    accuracy,
    maximumFocusErrorRate,
    requiresComplete: true,
    requiresUnseenText: stage === "transfer",
    cumulativeReview: Boolean(exercise.cumulativeReview),
  };
}

export function assessGuidedAttempt(result = {}, lesson = {}, exercise = {}, options = {}) {
  const modernResult = asNumber(result.masteryRuleVersion) >= MASTERY_RULE_VERSION;
  const requirements = getGuidedExerciseRequirements(lesson, exercise);
  const requiredAccuracy = modernResult
    ? requirements.accuracy
    : asNumber(exercise.passAccuracy, asNumber(lesson.passAccuracy, 94));
  const accuracy = getResultAccuracy(result);
  const completion = clamp(asNumber(result.completion), 0, 100);
  const focusErrorRate = getFocusErrorRate(result, lesson, exercise);
  const valid = result.validSession !== false && result.benchmarkValid !== false;
  const previousExercise = options.previousMastery?.exerciseResults?.[exercise.id] ?? {};
  const attemptedFingerprints = new Set(previousExercise.attemptedFingerprints ?? []);
  const fingerprint = String(result.contentFingerprint || "");
  const currentContent = asNumber(result.contentVersion) >= asNumber(exercise.contentVersion);
  const alreadyAcceptedFingerprint = Boolean(
    previousExercise.passed
    && previousExercise.unseenPassed
    && previousExercise.lastContentFingerprint === fingerprint,
  );
  const freshFingerprint = Boolean(fingerprint)
    && (!attemptedFingerprints.has(fingerprint) || alreadyAcceptedFingerprint);
  const unseenTransfer = !requirements.requiresUnseenText
    || !modernResult
    || (result.unseenTransfer === true && currentContent && freshFingerprint);
  const focusControlled = !modernResult || focusErrorRate <= requirements.maximumFocusErrorRate;
  const reasons = [];
  if (!valid) reasons.push("invalid-session");
  if (completion < 99.9) reasons.push("incomplete");
  if (accuracy < requiredAccuracy) reasons.push("accuracy");
  if (!focusControlled) reasons.push("focus-control");
  if (!unseenTransfer) reasons.push("unseen-transfer");

  return {
    passed: reasons.length === 0,
    reasons,
    valid,
    accuracy: Math.round(accuracy * 10) / 10,
    requiredAccuracy,
    completion: Math.round(completion * 10) / 10,
    focusErrorRate: Math.round(focusErrorRate * 10) / 10,
    maximumFocusErrorRate: modernResult ? requirements.maximumFocusErrorRate : Math.max(10, 100 - requiredAccuracy + 5),
    unseenTransfer: Boolean(requirements.requiresUnseenText && modernResult && unseenTransfer),
    freshFingerprint,
    fingerprint: fingerprint || null,
    contentVersion: asNumber(result.contentVersion),
    masteryRuleVersion: modernResult ? MASTERY_RULE_VERSION : 1,
    stage: requirements.stage,
    cumulativeReview: requirements.cumulativeReview,
  };
}

function normaliseRecentAttempt(result = {}, lesson = {}, previous = {}, now = new Date()) {
  const accuracy = getResultAccuracy(result);
  const exercise = lesson.exercises?.find((item) => item.id === result.exerciseId) ?? {};
  const assessment = assessGuidedAttempt(result, lesson, exercise, { previousMastery: previous });
  const completion = clamp(asNumber(result.completion), 0, 100);

  return {
    id: result.id || `${result.exerciseId || "attempt"}-${toIso(now)}`,
    exerciseId: result.exerciseId || null,
    completedAt: result.completedAt || toIso(now),
    accuracy: Math.round(accuracy * 10) / 10,
    netWpm: Math.max(0, Math.round(asNumber(result.netWpm) * 10) / 10),
    consistency: clamp(Math.round(asNumber(result.consistency)), 0, 100),
    completion: Math.round(completion * 10) / 10,
    focusErrorRate: assessment.focusErrorRate,
    requiredAccuracy: assessment.requiredAccuracy,
    maximumFocusErrorRate: assessment.maximumFocusErrorRate,
    contentFingerprint: assessment.fingerprint,
    contentVersion: assessment.contentVersion,
    masteryRuleVersion: assessment.masteryRuleVersion,
    stage: assessment.stage,
    unseenTransfer: assessment.unseenTransfer,
    cumulativeReview: assessment.cumulativeReview,
    passReasons: assessment.reasons,
    passed: assessment.passed,
    valid: assessment.valid,
  };
}

function nextReviewInterval(previous = {}, passedReview = false) {
  if (!passedReview) return 1;
  const currentDays = Math.max(0, asNumber(previous.reviewIntervalDays));
  const currentIndex = REVIEW_INTERVALS.findIndex((days) => days >= currentDays);
  if (currentDays <= 0) return REVIEW_INTERVALS[0];
  if (currentIndex < 0) return REVIEW_INTERVALS.at(-1);
  return REVIEW_INTERVALS[Math.min(REVIEW_INTERVALS.length - 1, currentIndex + 1)];
}

export function calculateLessonMastery(previous = {}, result = {}, lesson, options = {}) {
  if (!lesson) return previous;
  const now = options.now ? new Date(options.now) : new Date();
  const baselineWpm = Math.max(8, asNumber(options.baselineWpm, result.netWpm || 8));
  const attempt = normaliseRecentAttempt(result, lesson, previous, now);
  const recentAttempts = [...(Array.isArray(previous.recentAttempts) ? previous.recentAttempts : []), attempt].slice(-9);
  const exerciseResults = { ...(previous.exerciseResults ?? {}) };
  const previouslyMastered = [MASTERY_STATES.MASTERED, MASTERY_STATES.REVIEW_DUE].includes(
    getEffectiveMasteryState(previous, now),
  ) || Boolean(previous.masteredAt);
  const reviewExerciseResults = { ...(previous.reviewExerciseResults ?? {}) };
  let reviewCycleStartedAt = previous.reviewCycleStartedAt ?? null;

  if (attempt.exerciseId) {
    const oldExercise = exerciseResults[attempt.exerciseId] ?? {};
    const attemptedFingerprints = attempt.contentFingerprint
      ? [...new Set([...(oldExercise.attemptedFingerprints ?? []), attempt.contentFingerprint])].slice(-8)
      : oldExercise.attemptedFingerprints ?? [];
    exerciseResults[attempt.exerciseId] = {
      attempts: asNumber(oldExercise.attempts) + 1,
      passed: Boolean(oldExercise.passed || attempt.passed),
      bestAccuracy: Math.max(asNumber(oldExercise.bestAccuracy), attempt.accuracy),
      bestWpm: Math.max(asNumber(oldExercise.bestWpm), attempt.netWpm),
      bestFocusAccuracy: Math.max(asNumber(oldExercise.bestFocusAccuracy), 100 - attempt.focusErrorRate),
      unseenPassed: Boolean(oldExercise.unseenPassed || (attempt.passed && attempt.unseenTransfer)),
      cumulativeReviewPassed: Boolean(oldExercise.cumulativeReviewPassed || (attempt.passed && attempt.cumulativeReview)),
      masteryRuleVersion: Math.max(asNumber(oldExercise.masteryRuleVersion, 1), attempt.masteryRuleVersion),
      contentVersion: Math.max(asNumber(oldExercise.contentVersion), attempt.contentVersion),
      lastContentFingerprint: attempt.contentFingerprint || oldExercise.lastContentFingerprint || null,
      attemptedFingerprints,
      lastAttemptAt: attempt.completedAt,
      lastPassedAt: attempt.passed ? attempt.completedAt : oldExercise.lastPassedAt ?? null,
    };

    if (previouslyMastered) {
      reviewCycleStartedAt ??= attempt.completedAt;
      const oldReview = reviewExerciseResults[attempt.exerciseId] ?? {};
      reviewExerciseResults[attempt.exerciseId] = {
        attempts: asNumber(oldReview.attempts) + 1,
        passed: Boolean(oldReview.passed || attempt.passed),
        bestAccuracy: Math.max(asNumber(oldReview.bestAccuracy), attempt.accuracy),
        bestFocusAccuracy: Math.max(asNumber(oldReview.bestFocusAccuracy), 100 - attempt.focusErrorRate),
        unseenPassed: Boolean(oldReview.unseenPassed || (attempt.passed && attempt.unseenTransfer)),
        cumulativeReviewPassed: Boolean(oldReview.cumulativeReviewPassed || (attempt.passed && attempt.cumulativeReview)),
        masteryRuleVersion: Math.max(asNumber(oldReview.masteryRuleVersion, 1), attempt.masteryRuleVersion),
        contentVersion: Math.max(asNumber(oldReview.contentVersion), attempt.contentVersion),
        lastContentFingerprint: attempt.contentFingerprint || oldReview.lastContentFingerprint || null,
        lastAttemptAt: attempt.completedAt,
        lastPassedAt: attempt.passed ? attempt.completedAt : oldReview.lastPassedAt ?? null,
      };
    }
  }

  const successfulAttempts = asNumber(previous.successfulAttempts) + (attempt.passed ? 1 : 0);
  const requiredExerciseIds = getRequiredExerciseIds(lesson);
  const passedExerciseIds = requiredExerciseIds.filter((id) => exerciseResults[id]?.passed);
  const allExercisesPassed = requiredExerciseIds.length > 0
    ? passedExerciseIds.length === requiredExerciseIds.length
    : successfulAttempts >= 2;

  const recentThree = recentAttempts.slice(-3);
  const recentAccuracy = average(recentThree.map((item) => item.accuracy));
  const recentConsistency = average(recentThree.map((item) => item.consistency));
  const recentFocusErrorRate = average(recentThree.map((item) => item.focusErrorRate));
  const requiredAccuracy = asNumber(lesson.passAccuracy, 94);
  const accuracyScore = clamp(((recentAccuracy - 80) / 20) * 100, 0, 100);
  const consistencyScore = clamp(recentConsistency, 0, 100);
  const focusScore = clamp(100 - (recentFocusErrorRate * 5), 0, 100);
  const repetitionScore = clamp((passedExerciseIds.length / Math.max(1, requiredExerciseIds.length)) * 100, 0, 100);
  const paceScore = clamp((attempt.netWpm / Math.max(8, baselineWpm * 0.8)) * 100, 0, 100);
  const masteryScore = Math.round(
    (accuracyScore * 0.35)
    + (consistencyScore * 0.18)
    + (focusScore * 0.22)
    + (repetitionScore * 0.2)
    + (paceScore * 0.05),
  );

  const wasMastered = previouslyMastered;
  const strongEnough = allExercisesPassed
    && successfulAttempts >= Math.max(2, requiredExerciseIds.length)
    && recentAccuracy >= requiredAccuracy
    && recentConsistency >= 40
    && recentFocusErrorRate <= Math.max(10, 100 - requiredAccuracy + 5)
    && masteryScore >= 72;
  let state = successfulAttempts > 0 ? MASTERY_STATES.PRACTISING : MASTERY_STATES.LEARNING;
  let masteredAt = previous.masteredAt ?? null;
  let reviewIntervalDays = Math.max(0, asNumber(previous.reviewIntervalDays));
  let dueAt = previous.dueAt ?? null;
  let reviewCount = asNumber(previous.reviewCount);

  if (wasMastered) {
    if (attempt.valid && !attempt.passed) {
      reviewIntervalDays = 1;
      dueAt = toIso(now);
      state = MASTERY_STATES.REVIEW_DUE;
    } else {
      state = getEffectiveMasteryState(previous, now);
    }
  } else if (strongEnough) {
    masteredAt = toIso(now);
    reviewIntervalDays = REVIEW_INTERVALS[0];
    dueAt = addDays(now, reviewIntervalDays);
    state = MASTERY_STATES.MASTERED;
  }

  return {
    ...previous,
    attempts: asNumber(previous.attempts) + 1,
    successfulAttempts,
    bestWpm: Math.max(asNumber(previous.bestWpm), attempt.netWpm),
    bestAccuracy: Math.max(asNumber(previous.bestAccuracy), attempt.accuracy),
    averageAccuracy: Math.round(average(recentAttempts.map((item) => item.accuracy)) * 10) / 10,
    averageConsistency: Math.round(average(recentAttempts.map((item) => item.consistency))),
    focusErrorRate: Math.round(average(recentAttempts.map((item) => item.focusErrorRate)) * 10) / 10,
    masteryScore,
    state,
    exerciseResults,
    passedExerciseIds,
    recentAttempts,
    masteredAt,
    lastPractisedAt: attempt.completedAt,
    lastPassedAt: attempt.passed ? attempt.completedAt : previous.lastPassedAt ?? null,
    reviewIntervalDays,
    reviewCount,
    dueAt,
    reviewExerciseResults,
    reviewCycleStartedAt,
  };
}

export function finaliseLessonMastery(mastery = {}, lesson, now = new Date()) {
  if (!lesson) return mastery;
  const requiredIds = getRequiredExerciseIds(lesson);
  const passedIds = requiredIds.filter((id) => mastery.exerciseResults?.[id]?.passed);

  if (mastery.masteredAt) {
    const reviewPassedIds = requiredIds.filter((id) => mastery.reviewExerciseResults?.[id]?.passed);
    if (reviewPassedIds.length !== requiredIds.length) {
      return { ...mastery, passedExerciseIds: passedIds, reviewPassedExerciseIds: reviewPassedIds };
    }

    const reviewIntervalDays = nextReviewInterval(mastery, true);
    return {
      ...mastery,
      state: MASTERY_STATES.MASTERED,
      passedExerciseIds: passedIds,
      reviewPassedExerciseIds: [],
      reviewExerciseResults: {},
      reviewCycleStartedAt: null,
      reviewIntervalDays,
      reviewCount: asNumber(mastery.reviewCount) + 1,
      lastReviewedAt: toIso(now),
      dueAt: addDays(now, reviewIntervalDays),
    };
  }

  const allPassed = requiredIds.length > 0 && passedIds.length === requiredIds.length;
  const requiredAccuracy = asNumber(lesson.passAccuracy, 94);
  const eligible = allPassed
    && asNumber(mastery.successfulAttempts) >= requiredIds.length
    && asNumber(mastery.averageAccuracy) >= requiredAccuracy
    && asNumber(mastery.masteryScore) >= 72;

  if (!eligible) return { ...mastery, passedExerciseIds: passedIds };
  return {
    ...mastery,
    state: MASTERY_STATES.MASTERED,
    masteredAt: toIso(now),
    reviewIntervalDays: REVIEW_INTERVALS[0],
    dueAt: addDays(now, REVIEW_INTERVALS[0]),
    passedExerciseIds: passedIds,
    reviewExerciseResults: {},
    reviewCycleStartedAt: null,
  };
}


export function applyGuidedLessonResult(previous = {}, result = {}, lesson, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const calculated = calculateLessonMastery(previous, result, lesson, { ...options, now });
  return finaliseLessonMastery(calculated, lesson, now);
}

export function getEffectiveMasteryState(mastery = {}, now = new Date()) {
  const state = mastery.state || (mastery.masteredAt ? MASTERY_STATES.MASTERED : MASTERY_STATES.LEARNING);
  if ([MASTERY_STATES.MASTERED, MASTERY_STATES.REVIEW_DUE].includes(state) && mastery.dueAt) {
    const dueTime = new Date(mastery.dueAt).getTime();
    const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
    if (Number.isFinite(dueTime) && dueTime <= nowTime) return MASTERY_STATES.REVIEW_DUE;
  }
  return state;
}

function placementForStartLesson(startLessonId, config = {}) {
  const startIndex = Math.max(0, lessons.findIndex((lesson) => lesson.id === startLessonId));
  return {
    source: config.source || "setup",
    level: config.level || "Foundation",
    startLessonId: lessons[startIndex]?.id ?? lessons[0].id,
    creditedLessonIds: lessons.slice(0, startIndex).map((lesson) => lesson.id),
    rationale: config.rationale || "Start with the full foundation path.",
    confidence: config.confidence || "high",
    placedAt: config.placedAt || new Date().toISOString(),
    diagnostic: config.diagnostic || null,
  };
}

export function getDefaultPlacement(profile = {}, now = new Date()) {
  const experience = profile.experience || "beginner";
  const rationale = experience === "touch-typist"
    ? "A diagnostic is required before safely skipping technique lessons, so the course starts at the foundation."
    : experience === "hunt-and-peck"
      ? "Looking at the keyboard usually means the finger map needs to be rebuilt from the home row."
      : "The complete foundation path introduces each movement in a safe order.";

  return placementForStartLesson("home-f-j", {
    source: "setup",
    level: experience === "touch-typist" ? "Unverified touch typist" : "Foundation",
    rationale,
    confidence: experience === "touch-typist" ? "low" : "high",
    placedAt: toIso(now),
  });
}

export function determineDiagnosticPlacement({ profile = {}, result = {}, now = new Date() } = {}) {
  const experience = profile.experience || "beginner";
  const accuracy = getResultAccuracy(result);
  const netWpm = asNumber(result.netWpm);
  const consistency = asNumber(result.consistency);
  const valid = result.benchmarkValid === true && result.validSession !== false && asNumber(result.charactersTyped, 20) >= 20;
  const diagnostic = { accuracy, netWpm, consistency };

  if (!valid) {
    return {
      ...getDefaultPlacement(profile, now),
      source: "diagnostic-invalid",
      rationale: "The diagnostic was interrupted or too short, so no lessons were skipped.",
      diagnostic,
      confidence: "low",
    };
  }

  if (experience === "beginner") {
    return placementForStartLesson("home-f-j", {
      source: "diagnostic",
      level: accuracy < 85 ? "Accuracy foundation" : "Beginner foundation",
      rationale: "The diagnostic creates a baseline, but beginners still need the full finger-placement sequence.",
      diagnostic,
      placedAt: toIso(now),
    });
  }

  if (experience === "hunt-and-peck") {
    return placementForStartLesson("home-f-j", {
      source: "diagnostic",
      level: "Technique rebuild",
      rationale: "Your speed baseline is saved, but looking at the keyboard means the touch-typing finger map should start from lesson 1.",
      diagnostic,
      placedAt: toIso(now),
    });
  }

  let startLessonId = "home-f-j";
  let level = "Accuracy foundation";
  let rationale = "Accuracy is not yet stable enough to skip the technique foundation.";

  if (accuracy >= 96 && netWpm >= 55 && consistency >= 70) {
    startLessonId = "capital-letters";
    level = "Experienced touch typist";
    rationale = "Strong speed, accuracy, and consistency validated alphabet control. Capitals, punctuation, and the number row still require direct checkpoints before they can be credited.";
  } else if (accuracy >= 95 && netWpm >= 40) {
    startLessonId = "common-words";
    level = "Intermediate touch typist";
    rationale = "The diagnostic validated the alphabet, but it did not directly test capitals, symbols, or numbers. Begin with word fluency before those checkpoints.";
  } else if (accuracy >= 93 && netWpm >= 28) {
    startLessonId = "common-words";
    level = "Developing touch typist";
    rationale = "The diagnostic validated the basic alphabet. Begin with word fluency, then complete capitals, punctuation, and number-row checkpoints.";
  } else if (accuracy >= 90 && netWpm >= 18) {
    startLessonId = "alphabet-fluency";
    level = "Early touch typist";
    rationale = "Home and reach control are usable, but full-alphabet fluency should be confirmed before practical text.";
  } else if (accuracy >= 88) {
    startLessonId = "home-row-fluency";
    level = "Home-row checkpoint";
    rationale = "Basic control is present, but accuracy and rhythm need a home-row checkpoint before adding all reaches.";
  }

  return placementForStartLesson(startLessonId, {
    source: "diagnostic",
    level,
    rationale,
    diagnostic,
    confidence: startLessonId === "home-f-j" ? "medium" : "high",
    placedAt: toIso(now),
  });
}

export function getPlacementCredits(data = {}) {
  return Array.isArray(data.adaptive?.placement?.creditedLessonIds)
    ? data.adaptive.placement.creditedLessonIds
    : [];
}

export function getReviewQueue(data = {}, now = new Date()) {
  return Object.entries(data.progress?.lessonMastery ?? {})
    .map(([lessonId, mastery]) => ({
      lessonId,
      lesson: getLessonById(lessonId),
      mastery,
      state: getEffectiveMasteryState(mastery, now),
    }))
    .filter((item) => item.lesson && item.state === MASTERY_STATES.REVIEW_DUE)
    .sort((a, b) => new Date(a.mastery.dueAt || 0) - new Date(b.mastery.dueAt || 0));
}

export function getNextRecommendedLesson(data = {}) {
  const completed = new Set(data.progress?.completedLessons ?? []);
  const credits = new Set(getPlacementCredits(data));
  const activeId = data.progress?.activeLessonId;
  const active = getLessonById(activeId);

  if (active && !completed.has(active.id) && !credits.has(active.id)) return active;
  return lessons.find((lesson) => !completed.has(lesson.id) && !credits.has(lesson.id)) ?? null;
}

export function getCourseProgress(data = {}) {
  const completed = new Set(data.progress?.completedLessons ?? []);
  const credits = new Set(getPlacementCredits(data));
  const masteredCount = lessons.filter((lesson) => completed.has(lesson.id)).length;
  const creditedCount = lessons.filter((lesson) => credits.has(lesson.id) && !completed.has(lesson.id)).length;
  const reachedCount = masteredCount + creditedCount;
  return {
    masteredCount,
    creditedCount,
    reachedCount,
    total: lessons.length,
    percentage: lessons.length ? (reachedCount / lessons.length) * 100 : 0,
  };
}

export function isAdaptiveLessonUnlocked(lessonId, data = {}) {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return false;
  const completed = new Set(data.progress?.completedLessons ?? []);
  const credits = new Set(getPlacementCredits(data));
  if (completed.has(lessonId) || credits.has(lessonId)) return true;
  if (index === 0) return true;
  const previousId = lessons[index - 1].id;
  return completed.has(previousId) || credits.has(previousId);
}

export function getLessonAdaptiveState(lessonId, data = {}, now = new Date()) {
  const completed = new Set(data.progress?.completedLessons ?? []);
  const credits = new Set(getPlacementCredits(data));
  if (credits.has(lessonId) && !completed.has(lessonId)) return MASTERY_STATES.PLACEMENT_CREDIT;
  const mastery = data.progress?.lessonMastery?.[lessonId];
  if (mastery) return getEffectiveMasteryState(mastery, now);
  return isAdaptiveLessonUnlocked(lessonId, data) ? MASTERY_STATES.LEARNING : MASTERY_STATES.LOCKED;
}

function getTodayAttempts(data, todayKey) {
  return (data.attempts ?? []).filter((attempt) => (
    attempt.completedAt && getLocalDateKey(new Date(attempt.completedAt)) === todayKey
  ));
}

function getAttemptSeconds(attempt = {}) {
  return Math.max(0, asNumber(attempt.durationSeconds));
}

function getAttemptAccuracy(attempt = {}) {
  return clamp(asNumber(attempt.keystrokeAccuracy, asNumber(attempt.accuracy)), 0, 100);
}

function isValidAttempt(attempt = {}) {
  return attempt.validSession !== false && attempt.benchmarkValid !== false;
}

function hasPassedTarget(attempt = {}, accuracyTarget = 0, requireComplete = false) {
  if (!isValidAttempt(attempt)) return false;
  if (attempt.sessionPassed === false) return false;
  if (getAttemptAccuracy(attempt) < accuracyTarget) return false;
  if (requireComplete && asNumber(attempt.completion) < 99.9) return false;
  return true;
}

function benchmarkDue(data, now = new Date()) {
  const latestValidTestTime = (data.attempts ?? [])
    .filter((attempt) => (
      attempt.type === "test"
      && attempt.benchmarkValid === true
      && attempt.personalBestEligible === true
      && attempt.validSession !== false
    ))
    .reduce((latest, attempt) => {
      const time = new Date(attempt.completedAt).getTime();
      return Number.isFinite(time) ? Math.max(latest, time) : latest;
    }, 0);
  if (!latestValidTestTime) return true;
  const intervalDays = data.profile?.primaryGoal === "speed" ? 3 : 7;
  return (now.getTime() - latestValidTestTime) >= intervalDays * DAY_MS;
}

function weakKeyLabels(data, limit = 3) {
  return Object.entries(data.statistics?.keyStats ?? {})
    .map(([key, stat]) => {
      const attempts = asNumber(stat.attempts);
      const errors = asNumber(stat.errors);
      return { key, attempts, errors, rate: attempts ? (errors / attempts) * 100 : 0 };
    })
    .filter((item) => item.attempts >= 8 && item.errors > 0)
    .sort((a, b) => b.rate - a.rate || b.errors - a.errors)
    .slice(0, limit)
    .map((item) => item.key);
}

function createPlanItem(config) {
  return {
    id: config.id,
    type: config.type,
    title: config.title,
    description: config.description,
    minutes: Math.max(1, Math.round(config.minutes)),
    to: config.to,
    state: config.state,
    priority: config.priority ?? 0,
    completionRule: config.completionRule ?? {},
    done: false,
    progressSeconds: 0,
    progressMinutes: 0,
  };
}

function matchingPlanAttempts(item, attempts = []) {
  const rule = item.completionRule ?? {};
  if (item.type === "lesson") {
    return attempts.filter((attempt) => (
      ["lesson", "lesson-practice"].includes(attempt.type)
      && attempt.lessonId === rule.lessonId
      && attempt.reviewAttempt !== true
    ));
  }
  if (item.type === "review") {
    return attempts.filter((attempt) => (
      attempt.lessonId === rule.lessonId
      && (attempt.type === "spaced-review"
        || (["lesson", "lesson-practice"].includes(attempt.type) && attempt.reviewAttempt === true))
    ));
  }
  if (item.type === "benchmark") {
    return attempts.filter((attempt) => attempt.type === "test" && attempt.testId === rule.testId);
  }
  if (["warmup", "smart", "work", "accuracy"].includes(item.type)) {
    return attempts.filter((attempt) => (
      attempt.type === "practice"
      && (rule.presetIds ?? []).includes(attempt.presetId)
    ));
  }
  return [];
}

export function evaluateDailyPlanItem(item, data = {}, todayKey = getLocalDateKey()) {
  const attempts = matchingPlanAttempts(item, getTodayAttempts(data, todayKey));
  const rule = item.completionRule ?? {};
  const requiredSeconds = Math.max(60, item.minutes * 60);
  const qualifying = attempts.filter((attempt) => {
    if (item.type === "benchmark") {
      return attempt.benchmarkValid === true
        && attempt.personalBestEligible === true
        && attempt.validSession !== false;
    }
    return hasPassedTarget(attempt, asNumber(rule.accuracyTarget), Boolean(rule.requireComplete));
  });
  const progressSeconds = Math.min(
    requiredSeconds,
    qualifying.reduce((sum, attempt) => sum + getAttemptSeconds(attempt), 0),
  );
  const durationReached = progressSeconds >= requiredSeconds * (rule.durationThreshold ?? 0.9);
  let stateRequirementMet = true;

  if (item.type === "lesson") {
    stateRequirementMet = qualifying.some((attempt) => (
      attempt.practiceMode === "guided" && attempt.sessionPassed !== false
    ));
  }

  if (item.type === "review") {
    const mastery = data.progress?.lessonMastery?.[rule.lessonId] ?? {};
    const practisedToday = mastery.lastPractisedAt
      && getLocalDateKey(new Date(mastery.lastPractisedAt)) === todayKey;
    const reviewedToday = mastery.lastReviewedAt
      && getLocalDateKey(new Date(mastery.lastReviewedAt)) === todayKey;
    stateRequirementMet = Boolean(practisedToday && reviewedToday);
  }

  const done = item.type === "benchmark"
    ? qualifying.length > 0
    : durationReached && stateRequirementMet;
  const progressMinutes = Math.round((progressSeconds / 60) * 10) / 10;

  return {
    ...item,
    done,
    progressSeconds,
    progressMinutes,
    attempted: attempts.length > 0,
    qualifyingAttempts: qualifying.length,
    statusLabel: done
      ? "Complete"
      : attempts.length > 0 && qualifying.length === 0
        ? "Target not met"
        : progressSeconds > 0
          ? `${progressMinutes} of ${item.minutes} min`
          : "Not started",
  };
}

export function buildDailyPlan(data = {}, nowValue = new Date()) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  const todayKey = getLocalDateKey(now);
  const todayAttempts = getTodayAttempts(data, todayKey);
  const goalMinutes = clamp(Math.round(asNumber(data.settings?.dailyGoalMinutes, 15)), 5, 30);
  const primaryGoal = data.profile?.primaryGoal || "accuracy";
  const reviews = getReviewQueue(data, now);
  const nextLesson = getNextRecommendedLesson(data);
  const weakKeys = weakKeyLabels(data);
  const seed = Number(todayKey.replaceAll("-", ""));
  const items = [];
  let remaining = goalMinutes;

  const previousReviewAttempt = [...todayAttempts].reverse().find((attempt) => (
    attempt.lessonId
    && (attempt.type === "spaced-review" || attempt.reviewAttempt === true)
  ));
  const reviewLesson = reviews[0]?.lesson ?? getLessonById(previousReviewAttempt?.lessonId);
  const previousLessonAttempt = [...todayAttempts].reverse().find((attempt) => (
    ["lesson", "lesson-practice"].includes(attempt.type)
    && attempt.reviewAttempt !== true
    && attempt.lessonId
  ));
  const previousBenchmarkAttempt = [...todayAttempts].reverse().find((attempt) => (
    attempt.type === "test" && attempt.testId === "standard-60"
  ));
  const plannedLesson = getLessonById(previousLessonAttempt?.lessonId) ?? nextLesson;

  const push = (item) => {
    if (remaining <= 0) return;
    const minutes = Math.min(item.minutes, remaining);
    if (minutes <= 0) return;
    items.push(createPlanItem({ ...item, minutes }));
    remaining -= minutes;
  };

  if (goalMinutes >= 10) {
    const minutes = goalMinutes >= 20 ? 3 : 2;
    push({
      id: `warmup-${todayKey}`,
      type: "warmup",
      title: "Controlled warm-up",
      description: "Easy familiar words to settle posture, rhythm, and screen focus.",
      minutes,
      to: "/practice/session",
      state: { config: { presetId: "warmup", contentType: "words", category: "general", goalType: "time", durationSeconds: minutes * 60, difficulty: "easy", accuracyTarget: 95, seed } },
      completionRule: { presetIds: ["warmup"], accuracyTarget: 95 },
      priority: 1,
    });
  }

  if (reviewLesson) {
    push({
      id: `review-${reviewLesson.id}-${todayKey}`,
      type: "review",
      title: `Review: ${reviewLesson.title}`,
      description: "Run the short retention check. A pass advances the interval; a miss stays due for targeted recovery.",
      minutes: Math.min(2, Math.max(1, remaining)),
      to: `/review/${reviewLesson.id}`,
      completionRule: {
        lessonId: reviewLesson.id,
        accuracyTarget: 95,
        durationThreshold: 0.74,
      },
      priority: 10,
    });
  }

  if (plannedLesson) {
    const lessonMinutes = goalMinutes <= 5
      ? remaining
      : Math.min(Math.max(4, Math.round(goalMinutes * 0.45)), remaining);
    push({
      id: `lesson-${plannedLesson.id}-${todayKey}`,
      type: "lesson",
      title: `Continue: ${plannedLesson.title}`,
      description: "Pass at least one guided exercise and use longer or timed practice to complete the planned work.",
      minutes: lessonMinutes,
      to: `/learn/${plannedLesson.id}`,
      completionRule: {
        lessonId: plannedLesson.id,
        accuracyTarget: asNumber(plannedLesson.passAccuracy, 94),
        durationThreshold: 0.8,
      },
      priority: 8,
    });
  }

  if (remaining > 0 && (weakKeys.length > 0 || primaryGoal === "accuracy")) {
    const minutes = Math.min(5, remaining);
    push({
      id: `smart-${todayKey}`,
      type: "smart",
      title: weakKeys.length ? `Target weak keys: ${weakKeys.join(", ")}` : "Build an accuracy baseline",
      description: weakKeys.length ? "Generated from your highest local error rates." : "Collect enough clean practice data for targeted recommendations.",
      minutes,
      to: "/practice/session",
      state: { config: { presetId: "smart", purpose: "adaptive", contentType: "words", category: "general", goalType: "time", durationSeconds: minutes * 60, difficulty: "adaptive", targetDensity: 0.4, focusKeys: weakKeys, accuracyTarget: 95, seed: seed + 1 } },
      completionRule: { presetIds: ["smart"], accuracyTarget: 95 },
      priority: 7,
    });
  }

  if (remaining > 0 && primaryGoal === "work") {
    const minutes = remaining;
    push({
      id: `work-${todayKey}`,
      type: "work",
      title: "Practical transfer",
      description: "Type natural sentences used in study, forms, email, and office work.",
      minutes,
      to: "/practice/session",
      state: { config: { presetId: "daily-work", contentType: "sentences", category: "work", goalType: "time", durationSeconds: minutes * 60, punctuation: true, capitals: true, accuracyTarget: 95, seed: seed + 2 } },
      completionRule: { presetIds: ["daily-work"], accuracyTarget: 95 },
      priority: 5,
    });
  }

  if (remaining > 0 && (previousBenchmarkAttempt || benchmarkDue(data, now)) && goalMinutes >= 10) {
    push({
      id: `benchmark-${todayKey}`,
      type: "benchmark",
      title: "1-minute progress check",
      description: "Only a valid, full-duration check completes this step.",
      minutes: 1,
      to: "/tests/standard-60",
      completionRule: { testId: "standard-60" },
      priority: 3,
    });
  }

  if (remaining > 0) {
    const presetId = primaryGoal === "speed" ? "sprint" : "accuracy";
    const target = primaryGoal === "speed" ? 94 : 97;
    const minutes = remaining;
    push({
      id: `accuracy-${todayKey}`,
      type: "accuracy",
      title: primaryGoal === "speed" ? "Controlled speed finish" : "Accuracy finish",
      description: primaryGoal === "speed" ? "Finish with familiar words at a smooth sustainable pace." : "Finish slowly enough to keep every movement deliberate.",
      minutes,
      to: "/practice/session",
      state: { config: { presetId, contentType: "words", category: "general", goalType: "time", durationSeconds: minutes * 60, difficulty: primaryGoal === "speed" ? "balanced" : "easy", accuracyTarget: target, seed: seed + 3 } },
      completionRule: { presetIds: [presetId], accuracyTarget: target },
      priority: 2,
    });
  }

  const withStatus = items.map((item) => evaluateDailyPlanItem(item, data, todayKey));
  const completedMinutes = Math.round(Math.min(
    goalMinutes,
    withStatus.reduce((sum, item) => sum + item.progressMinutes, 0),
  ) * 10) / 10;

  return {
    dateKey: todayKey,
    goalMinutes,
    primaryGoal,
    title: `${goalMinutes}-minute ${primaryGoal === "work" ? "practical" : primaryGoal === "speed" ? "speed-building" : "accuracy-first"} plan`,
    description: reviews.length > 0 || previousReviewAttempt
      ? "A review is prioritised before new learning. Progress is based on qualifying active time, not a single click or attempt."
      : "Progress counts only valid work that meets the step target, so the plan reflects what you actually completed.",
    items: withStatus,
    completedMinutes,
    remainingMinutes: Math.round(Math.max(0, goalMinutes - completedMinutes) * 10) / 10,
    reviewDueCount: reviews.length,
  };
}

export function upgradeLegacyMastery(mastery = {}, lessonId, completed = false, now = new Date()) {
  const lesson = getLessonById(lessonId);
  if (!lesson) return mastery;
  const requiredIds = getRequiredExerciseIds(lesson);
  const legacyCompleted = completed || Boolean(mastery.lastCompletedAt) || mastery.state === MASTERY_STATES.MASTERED;
  if (!legacyCompleted) {
    return {
      ...mastery,
      state: mastery.state || (asNumber(mastery.attempts) > 0 ? MASTERY_STATES.PRACTISING : MASTERY_STATES.LEARNING),
      masteryScore: asNumber(mastery.masteryScore),
      exerciseResults: mastery.exerciseResults ?? {},
      passedExerciseIds: Array.isArray(mastery.passedExerciseIds) ? mastery.passedExerciseIds : [],
      recentAttempts: Array.isArray(mastery.recentAttempts) ? mastery.recentAttempts.slice(-9) : [],
      reviewExerciseResults: mastery.reviewExerciseResults ?? {},
      reviewCycleStartedAt: mastery.reviewCycleStartedAt ?? null,
    };
  }

  const masteredAt = mastery.masteredAt || mastery.lastCompletedAt || toIso(now);
  const exerciseResults = { ...(mastery.exerciseResults ?? {}) };
  requiredIds.forEach((id) => {
    exerciseResults[id] ??= {
      attempts: 1,
      passed: true,
      bestAccuracy: asNumber(mastery.bestAccuracy, lesson.passAccuracy),
      bestWpm: asNumber(mastery.bestWpm),
      lastAttemptAt: masteredAt,
      lastPassedAt: masteredAt,
    };
  });

  return {
    ...mastery,
    attempts: Math.max(asNumber(mastery.attempts), requiredIds.length),
    successfulAttempts: Math.max(asNumber(mastery.successfulAttempts), requiredIds.length),
    state: MASTERY_STATES.MASTERED,
    masteryScore: Math.max(asNumber(mastery.masteryScore), 85),
    averageAccuracy: Math.max(asNumber(mastery.averageAccuracy), asNumber(mastery.bestAccuracy, lesson.passAccuracy)),
    averageConsistency: Math.max(asNumber(mastery.averageConsistency), 60),
    focusErrorRate: asNumber(mastery.focusErrorRate),
    exerciseResults,
    passedExerciseIds: requiredIds,
    recentAttempts: Array.isArray(mastery.recentAttempts) ? mastery.recentAttempts.slice(-9) : [],
    masteredAt,
    lastPractisedAt: mastery.lastPractisedAt || masteredAt,
    reviewIntervalDays: Math.max(asNumber(mastery.reviewIntervalDays), REVIEW_INTERVALS[0]),
    dueAt: mastery.dueAt || addDays(masteredAt, REVIEW_INTERVALS[0]),
    reviewCount: asNumber(mastery.reviewCount),
    reviewExerciseResults: mastery.reviewExerciseResults ?? {},
    reviewCycleStartedAt: mastery.reviewCycleStartedAt ?? null,
  };
}
