function normaliseIndexes(indexes = [], total = 0) {
  return [...new Set(
    (Array.isArray(indexes) ? indexes : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value < total),
  )].sort((a, b) => a - b);
}

export function getPassedLessonExerciseIndexes(lesson, mastery = {}) {
  if (!lesson?.exercises?.length) return [];
  return lesson.exercises
    .map((exercise, index) => mastery.exerciseResults?.[exercise.id]?.passed ? index : null)
    .filter((index) => index !== null);
}

export function getLessonStepAccess(lesson, passedIndexes = [], { mastered = false } = {}) {
  if (!lesson?.exercises?.length) return [];
  const total = lesson.exercises.length;
  const passed = new Set(normaliseIndexes(passedIndexes, total));

  return lesson.exercises.map((exercise, index) => {
    const prerequisitesPassed = lesson.exercises
      .slice(0, index)
      .every((_, prerequisiteIndex) => passed.has(prerequisiteIndex));
    const completed = Boolean(mastered || passed.has(index));
    const unlocked = Boolean(mastered || completed || prerequisitesPassed);

    return {
      id: exercise.id,
      index,
      completed,
      unlocked,
      prerequisitesPassed,
    };
  });
}

export function getInitialLessonExerciseIndex(lesson, passedIndexes = [], { mastered = false } = {}) {
  const access = getLessonStepAccess(lesson, passedIndexes, { mastered });
  if (!access.length) return 0;
  if (mastered) return 0;

  const next = access.find((step) => step.unlocked && !step.completed);
  if (next) return next.index;

  const lastCompleted = [...access].reverse().find((step) => step.completed);
  return lastCompleted?.index ?? 0;
}
