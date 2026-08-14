import { getEffectiveMasteryState, MASTERY_STATES } from "./adaptiveLearning.js";

export const SPACED_REVIEW_ENTRY_VERSION = 1;

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
    lessonRoute: `/learn/${lesson.id}`,
    returnTo: "/",
    canReview: due,
  };
}
