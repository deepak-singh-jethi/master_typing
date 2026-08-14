import { generatePracticeSession } from "../data/contentBank.js";
import { getEffectiveMasteryState, MASTERY_STATES } from "./adaptiveLearning.js";

export const SPACED_REVIEW_ENTRY_VERSION = 1;
export const SPACED_REVIEW_SESSION_VERSION = 1;

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

export function buildSpacedReviewSessionPlan({ lesson, mastery = {}, seed = null } = {}) {
  if (!lesson) {
    return {
      version: SPACED_REVIEW_SESSION_VERSION,
      kind: "spaced-review-session",
      lessonId: null,
      stages: [],
      totalDurationSeconds: 0,
    };
  }

  const baseSeed = normaliseSeed(seed ?? getSpacedReviewSessionSeed({ lesson, mastery }));
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
