import test from "node:test";
import assert from "node:assert/strict";
import {
  applyGuidedLessonResult,
  buildDailyPlan,
  calculateLessonMastery,
  determineDiagnosticPlacement,
  finaliseLessonMastery,
  getEffectiveMasteryState,
  getNextRecommendedLesson,
  getReviewQueue,
  MASTERY_STATES,
} from "../lib/adaptiveLearning.js";
import { getLessonById, lessons } from "../data/curriculum.js";
import { DATA_VERSION, validateImportedData } from "../lib/storage.js";

function resultFor(exerciseId, overrides = {}) {
  return {
    exerciseId,
    accuracy: 96,
    keystrokeAccuracy: 96,
    netWpm: 28,
    consistency: 76,
    completion: 100,
    validSession: true,
    keyStats: {},
    ...overrides,
  };
}

function appData(overrides = {}) {
  return {
    profile: { experience: "beginner", primaryGoal: "accuracy" },
    settings: { dailyGoalMinutes: 15 },
    adaptive: { placement: { creditedLessonIds: [], startLessonId: "home-f-j" } },
    progress: {
      activeLessonId: "home-f-j",
      completedLessons: [],
      lessonMastery: {},
      ...overrides.progress,
    },
    statistics: { keyStats: {}, bigramStats: {}, wordStats: {}, dailyActivity: {}, ...overrides.statistics },
    attempts: overrides.attempts ?? [],
  };
}

test("beginners never skip finger-placement lessons after the diagnostic", () => {
  const placement = determineDiagnosticPlacement({
    profile: { experience: "beginner" },
    result: { accuracy: 99, netWpm: 80, consistency: 90, charactersTyped: 500, benchmarkValid: true },
  });
  assert.equal(placement.startLessonId, "home-f-j");
  assert.deepEqual(placement.creditedLessonIds, []);
});

test("hunt-and-peck typists rebuild technique even with a fast baseline", () => {
  const placement = determineDiagnosticPlacement({
    profile: { experience: "hunt-and-peck" },
    result: { accuracy: 97, netWpm: 55, consistency: 80, charactersTyped: 300, benchmarkValid: true },
  });
  assert.equal(placement.startLessonId, "home-f-j");
  assert.match(placement.rationale, /finger map|keyboard/i);
});

test("verified touch typists receive placement credit only before the chosen checkpoint", () => {
  const placement = determineDiagnosticPlacement({
    profile: { experience: "touch-typist" },
    result: { accuracy: 95, netWpm: 43, consistency: 72, charactersTyped: 300, benchmarkValid: true },
  });
  assert.equal(placement.startLessonId, "common-words");
  assert.ok(placement.creditedLessonIds.includes("alphabet-fluency"));
  assert.ok(!placement.creditedLessonIds.includes("capital-letters"));
  assert.ok(!placement.creditedLessonIds.includes("numbers-dates"));
});

test("one successful exercise does not master a lesson", () => {
  const lesson = getLessonById("home-f-j");
  const mastery = calculateLessonMastery({}, resultFor("anchors"), lesson, {
    now: "2026-08-01T00:00:00.000Z",
    baselineWpm: 25,
  });
  assert.equal(mastery.state, MASTERY_STATES.PRACTISING);
  assert.equal(mastery.passedExerciseIds.length, 1);
});

test("all distinct guided exercises can master a lesson", () => {
  const lesson = getLessonById("home-f-j");
  let mastery = {};
  lesson.exercises.forEach((exercise, index) => {
    mastery = calculateLessonMastery(mastery, resultFor(exercise.id), lesson, {
      now: new Date(Date.UTC(2026, 7, 1, 0, index, 0)),
      baselineWpm: 25,
    });
  });
  assert.equal(mastery.state, MASTERY_STATES.MASTERED);
  assert.equal(mastery.passedExerciseIds.length, lesson.exercises.length);
  assert.ok(mastery.masteryScore >= 72);
  assert.ok(mastery.dueAt);
});

test("mastered lessons become review-due when the interval expires", () => {
  const mastery = {
    state: MASTERY_STATES.MASTERED,
    masteredAt: "2026-08-01T00:00:00.000Z",
    dueAt: "2026-08-04T00:00:00.000Z",
  };
  assert.equal(getEffectiveMasteryState(mastery, new Date("2026-08-05T00:00:00.000Z")), MASTERY_STATES.REVIEW_DUE);
});

test("a successful spaced review extends the interval once after all review exercises", () => {
  const lesson = getLessonById("home-f-j");
  let mastery = {
    state: MASTERY_STATES.REVIEW_DUE,
    masteredAt: "2026-07-25T00:00:00.000Z",
    dueAt: "2026-08-01T00:00:00.000Z",
    reviewIntervalDays: 3,
    successfulAttempts: 3,
    attempts: 3,
    exerciseResults: Object.fromEntries(lesson.exercises.map((exercise) => [exercise.id, { passed: true }])),
    passedExerciseIds: lesson.exercises.map((exercise) => exercise.id),
  };
  lesson.exercises.forEach((exercise, index) => {
    mastery = calculateLessonMastery(mastery, resultFor(exercise.id, { accuracy: 98, keystrokeAccuracy: 98 }), lesson, {
      now: new Date(Date.UTC(2026, 7, 1, 0, index, 0)),
      baselineWpm: 25,
    });
  });
  assert.equal(mastery.reviewCount || 0, 0);
  const next = finaliseLessonMastery(mastery, lesson, new Date("2026-08-01T00:05:00.000Z"));
  assert.equal(next.state, MASTERY_STATES.MASTERED);
  assert.equal(next.reviewIntervalDays, 7);
  assert.equal(next.reviewCount, 1);
  assert.deepEqual(next.reviewExerciseResults, {});
});

test("a failed voluntary review is brought back into the review queue", () => {
  const lesson = getLessonById("home-f-j");
  const previous = {
    state: MASTERY_STATES.MASTERED,
    masteredAt: "2026-07-25T00:00:00.000Z",
    dueAt: "2026-08-10T00:00:00.000Z",
    reviewIntervalDays: 7,
    successfulAttempts: 3,
    attempts: 3,
    exerciseResults: Object.fromEntries(lesson.exercises.map((exercise) => [exercise.id, { passed: true }])),
    passedExerciseIds: lesson.exercises.map((exercise) => exercise.id),
  };
  const next = calculateLessonMastery(previous, resultFor("anchors", { accuracy: 70, keystrokeAccuracy: 70 }), lesson, {
    now: "2026-08-01T00:00:00.000Z",
    baselineWpm: 25,
  });
  assert.equal(next.state, MASTERY_STATES.REVIEW_DUE);
  assert.equal(next.reviewIntervalDays, 1);
});

test("daily plans use the selected time budget exactly", () => {
  for (const minutes of [5, 10, 15, 20]) {
    const data = appData();
    data.settings.dailyGoalMinutes = minutes;
    const plan = buildDailyPlan(data, new Date("2026-08-01T08:00:00.000Z"));
    assert.equal(plan.items.reduce((sum, item) => sum + item.minutes, 0), minutes);
    assert.equal(plan.goalMinutes, minutes);
  }
});

test("due reviews are scheduled before new lesson work", () => {
  const data = appData({
    progress: {
      lessonMastery: {
        "home-f-j": {
          state: MASTERY_STATES.MASTERED,
          masteredAt: "2026-07-20T00:00:00.000Z",
          dueAt: "2026-07-25T00:00:00.000Z",
        },
      },
      completedLessons: ["home-f-j"],
      activeLessonId: "home-d-k",
    },
  });
  const now = new Date("2026-08-01T08:00:00.000Z");
  const queue = getReviewQueue(data, now);
  const plan = buildDailyPlan(data, now);
  assert.equal(queue[0].lessonId, "home-f-j");
  assert.ok(plan.items.findIndex((item) => item.type === "review") < plan.items.findIndex((item) => item.type === "lesson"));
});

test("version 4 data migrates completed lessons into mastered phase-4B records", () => {
  const migrated = validateImportedData({
    version: 4,
    progress: {
      completedLessons: ["home-f-j"],
      lessonMastery: { "home-f-j": { attempts: 1, bestAccuracy: 95, bestWpm: 20 } },
    },
  });
  assert.equal(migrated.version, DATA_VERSION);
  assert.equal(migrated.progress.lessonMastery["home-f-j"].state, MASTERY_STATES.MASTERED);
  assert.equal(migrated.progress.lessonMastery["home-f-j"].passedExerciseIds.length, 3);
});

test("an interrupted diagnostic never grants placement credit", () => {
  const placement = determineDiagnosticPlacement({
    profile: { experience: "touch-typist" },
    result: {
      accuracy: 99,
      netWpm: 80,
      consistency: 90,
      charactersTyped: 10,
      benchmarkValid: false,
    },
  });
  assert.equal(placement.startLessonId, "home-f-j");
  assert.deepEqual(placement.creditedLessonIds, []);
  assert.equal(placement.confidence, "low");
});

test("daily-plan completion matches the intended practice preset only", () => {
  const data = appData({
    attempts: [{
      type: "practice",
      presetId: "warmup",
      completedAt: "2026-08-01T08:05:00.000Z",
      durationSeconds: 120,
      accuracy: 97,
      keystrokeAccuracy: 97,
      validSession: true,
      sessionPassed: true,
    }],
  });
  data.profile.primaryGoal = "speed";
  const plan = buildDailyPlan(data, new Date("2026-08-01T09:00:00.000Z"));
  const warmup = plan.items.find((item) => item.type === "warmup");
  const finish = plan.items.find((item) => item.type === "accuracy");
  assert.equal(warmup?.done, true);
  assert.equal(finish?.done, false);
});

test("benchmark scheduling finds the latest valid test even when imported attempts are unordered", () => {
  const data = appData({
    attempts: [
      { type: "test", testId: "standard-60", personalBestEligible: true, benchmarkValid: true, validSession: true, completedAt: "2026-07-01T08:00:00.000Z" },
      { type: "test", testId: "standard-60", personalBestEligible: true, benchmarkValid: true, validSession: true, completedAt: "2026-07-31T08:00:00.000Z" },
    ],
  });
  data.profile.primaryGoal = "speed";
  const plan = buildDailyPlan(data, new Date("2026-08-01T08:00:00.000Z"));
  assert.equal(plan.items.some((item) => item.type === "benchmark"), false);
});


test("the learner has no next lesson after the full foundation path is covered", () => {
  const data = appData({
    progress: {
      completedLessons: lessons.map((lesson) => lesson.id),
      activeLessonId: lessons.at(-1).id,
    },
  });
  assert.equal(getNextRecommendedLesson(data), null);
  const plan = buildDailyPlan(data, new Date("2026-08-01T08:00:00.000Z"));
  assert.equal(plan.items.some((item) => item.type === "lesson"), false);
  assert.equal(plan.items.reduce((sum, item) => sum + item.minutes, 0), 15);
});


test("guided attempt settlement persists mastery without relying on a results-screen click", () => {
  const lesson = getLessonById("home-f-j");
  let mastery = {};
  lesson.exercises.forEach((exercise, index) => {
    mastery = applyGuidedLessonResult(mastery, resultFor(exercise.id), lesson, {
      now: new Date(Date.UTC(2026, 7, 1, 1, index, 0)),
      baselineWpm: 25,
    });
  });
  assert.equal(mastery.state, MASTERY_STATES.MASTERED);
  assert.ok(mastery.masteredAt);
  assert.equal(mastery.passedExerciseIds.length, lesson.exercises.length);
});

test("guided attempt settlement completes a review exactly once on the last required exercise", () => {
  const lesson = getLessonById("home-f-j");
  let mastery = {
    state: MASTERY_STATES.REVIEW_DUE,
    masteredAt: "2026-07-25T00:00:00.000Z",
    dueAt: "2026-08-01T00:00:00.000Z",
    reviewIntervalDays: 3,
    successfulAttempts: 3,
    attempts: 3,
    exerciseResults: Object.fromEntries(lesson.exercises.map((exercise) => [exercise.id, { passed: true }])),
    passedExerciseIds: lesson.exercises.map((exercise) => exercise.id),
  };
  lesson.exercises.forEach((exercise, index) => {
    mastery = applyGuidedLessonResult(mastery, resultFor(exercise.id, { accuracy: 98, keystrokeAccuracy: 98 }), lesson, {
      now: new Date(Date.UTC(2026, 7, 1, 2, index, 0)),
      baselineWpm: 25,
    });
  });
  assert.equal(mastery.state, MASTERY_STATES.MASTERED);
  assert.equal(mastery.reviewCount, 1);
  assert.equal(mastery.reviewIntervalDays, 7);
  assert.deepEqual(mastery.reviewExerciseResults, {});
});
