import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyPlan, determineDiagnosticPlacement } from "../lib/adaptiveLearning.js";
import { generatePracticeText } from "../data/contentBank.js";
import { getLessonById, lessons } from "../data/curriculum.js";
import { getPerformanceSummary } from "../lib/performance.js";
import { DATA_VERSION, validateImportedData } from "../lib/storage.js";

function baseData(overrides = {}) {
  return {
    profile: { experience: "touch-typist", primaryGoal: "accuracy" },
    settings: { dailyGoalMinutes: 15 },
    adaptive: { placement: { creditedLessonIds: [], startLessonId: "home-f-j" } },
    progress: {
      activeLessonId: "home-f-j",
      completedLessons: [],
      lessonMastery: {},
      ...overrides.progress,
    },
    statistics: { keyStats: {}, bigramStats: {}, wordStats: {}, dailyActivity: {} },
    attempts: overrides.attempts ?? [],
  };
}

function validPractice(overrides = {}) {
  return {
    type: "practice",
    completedAt: "2026-08-01T08:05:00.000Z",
    durationSeconds: 120,
    accuracy: 98,
    keystrokeAccuracy: 98,
    validSession: true,
    sessionPassed: true,
    ...overrides,
  };
}

test("general-text diagnostic never credits capitals, punctuation, or numbers", () => {
  const placement = determineDiagnosticPlacement({
    profile: { experience: "touch-typist" },
    result: {
      accuracy: 99,
      netWpm: 75,
      consistency: 88,
      charactersTyped: 500,
      benchmarkValid: true,
      validSession: true,
    },
  });
  const startIndex = lessons.findIndex((lesson) => lesson.id === placement.startLessonId);
  const capitalsIndex = lessons.findIndex((lesson) => lesson.id === "capital-letters");
  assert.equal(placement.startLessonId, "capital-letters");
  assert.equal(startIndex, capitalsIndex);
  assert.ok(!placement.creditedLessonIds.includes("capital-letters"));
  assert.ok(!placement.creditedLessonIds.includes("punctuation"));
  assert.ok(!placement.creditedLessonIds.includes("numbers-dates"));
});

test("one short warm-up attempt creates partial progress instead of completing the step", () => {
  const data = baseData({
    attempts: [validPractice({ presetId: "warmup", durationSeconds: 35 })],
  });
  const plan = buildDailyPlan(data, new Date("2026-08-01T09:00:00.000Z"));
  const warmup = plan.items.find((item) => item.type === "warmup");
  assert.equal(warmup.done, false);
  assert.equal(warmup.progressMinutes, 0.6);
  assert.equal(warmup.statusLabel, "0.6 of 2 min");
});

test("failed accuracy work does not count toward daily-plan completion", () => {
  const data = baseData({
    attempts: [validPractice({
      presetId: "sprint",
      durationSeconds: 300,
      accuracy: 92,
      keystrokeAccuracy: 92,
      sessionPassed: false,
    })],
  });
  data.settings.dailyGoalMinutes = 5;
  data.profile.primaryGoal = "speed";
  data.progress.completedLessons = lessons.map((lesson) => lesson.id);
  data.progress.activeLessonId = lessons.at(-1).id;
  const plan = buildDailyPlan(data, new Date("2026-08-01T09:00:00.000Z"));
  const accuracy = plan.items.find((item) => item.type === "accuracy");
  assert.equal(accuracy.done, false);
  assert.equal(accuracy.progressMinutes, 0);
  assert.equal(accuracy.statusLabel, "Target not met");
});

test("invalid standard test cannot complete the benchmark plan step", () => {
  const data = baseData({
    attempts: [{
      type: "test",
      testId: "standard-60",
      completedAt: "2026-08-01T08:20:00.000Z",
      durationSeconds: 60,
      accuracy: 98,
      benchmarkValid: false,
      personalBestEligible: false,
    }],
  });
  data.profile.primaryGoal = "speed";
  data.settings.dailyGoalMinutes = 20;
  const plan = buildDailyPlan(data, new Date("2026-08-01T09:00:00.000Z"));
  const benchmark = plan.items.find((item) => item.type === "benchmark");
  assert.ok(benchmark);
  assert.equal(benchmark.done, false);
  assert.equal(benchmark.statusLabel, "Target not met");
});



test("a failed review with an older review count does not complete today's review step", () => {
  const data = baseData({
    attempts: [validPractice({
      type: "lesson",
      lessonId: "home-f-j",
      practiceMode: "guided",
      reviewAttempt: true,
      durationSeconds: 300,
    })],
    progress: {
      completedLessons: ["home-f-j"],
      lessonMastery: {
        "home-f-j": {
          state: "review-due",
          reviewCount: 2,
          lastPractisedAt: "2026-08-01T08:05:00.000Z",
          lastReviewedAt: "2026-07-20T08:05:00.000Z",
          dueAt: "2026-08-01T00:00:00.000Z",
        },
      },
    },
  });
  const plan = buildDailyPlan(data, new Date("2026-08-01T09:00:00.000Z"));
  const review = plan.items.find((item) => item.type === "review");
  assert.ok(review);
  assert.equal(review.done, false);
});

test("a review finalised today completes the stable review step", () => {
  const data = baseData({
    attempts: [validPractice({
      type: "lesson",
      lessonId: "home-f-j",
      practiceMode: "guided",
      reviewAttempt: true,
      durationSeconds: 300,
    })],
    progress: {
      completedLessons: ["home-f-j"],
      lessonMastery: {
        "home-f-j": {
          state: "mastered",
          reviewCount: 3,
          lastPractisedAt: "2026-08-01T08:05:00.000Z",
          lastReviewedAt: "2026-08-01T08:05:00.000Z",
          dueAt: "2026-08-08T00:00:00.000Z",
        },
      },
    },
  });
  const plan = buildDailyPlan(data, new Date("2026-08-01T09:00:00.000Z"));
  const review = plan.items.find((item) => item.type === "review");
  assert.ok(review);
  assert.equal(review.done, true);
});

test("a completed benchmark remains visible in today's plan", () => {
  const data = baseData({
    attempts: [{
      type: "test",
      testId: "standard-60",
      completedAt: "2026-08-01T08:20:00.000Z",
      durationSeconds: 60,
      accuracy: 98,
      benchmarkValid: true,
      personalBestEligible: true,
      validSession: true,
      sessionPassed: true,
    }],
  });
  data.profile.primaryGoal = "speed";
  data.settings.dailyGoalMinutes = 20;
  const plan = buildDailyPlan(data, new Date("2026-08-01T09:00:00.000Z"));
  const benchmark = plan.items.find((item) => item.type === "benchmark");
  assert.ok(benchmark);
  assert.equal(benchmark.done, true);
});

test("advanced lessons generate natural purpose-specific text instead of random key clusters", () => {
  for (const lessonId of ["practical-sentences", "emails-forms", "endurance", "foundation-assessment"]) {
    const lesson = getLessonById(lessonId);
    const text = generatePracticeText({
      contentType: "lesson",
      lessonId,
      goalType: "words",
      wordCount: 120,
      seed: 42,
    });
    assert.ok(text.split(/\s+/).length >= 100, `${lessonId} should provide enough text`);
    assert.match(text, /[.,:]/, `${lessonId} should contain natural punctuation`);
    assert.ok([...text].every((character) => lesson.allowedCharacters.includes(character)), `${lessonId} emitted a disallowed character`);
    const tinyClusters = text.split(/\s+/).filter((token) => /^[a-z]{2,4}$/i.test(token));
    assert.ok(tinyClusters.length < text.split(/\s+/).length * 0.65, `${lessonId} still looks like random key clusters`);
  }
});

test("performance summaries keep valid benchmarks separate from drills and invalid tests", () => {
  const attempts = [
    { type: "lesson", practiceMode: "guided", validSession: true, netWpm: 90, accuracy: 96, durationSeconds: 20 },
    { type: "practice", contentType: "words", validSession: true, netWpm: 42, accuracy: 97, durationSeconds: 300 },
    { type: "practice", contentType: "sentences", validSession: true, netWpm: 36, accuracy: 96, durationSeconds: 300 },
    { type: "practice", contentType: "numbers", validSession: true, netWpm: 31, accuracy: 95, durationSeconds: 180 },
    { type: "test", testId: "standard-60", benchmarkValid: true, personalBestEligible: true, netWpm: 51, accuracy: 95, durationSeconds: 60 },
    { type: "test", testId: "standard-60", benchmarkValid: false, personalBestEligible: false, netWpm: 88, accuracy: 70, durationSeconds: 20 },
  ];
  const summary = getPerformanceSummary(attempts);
  assert.equal(summary.standardBenchmark.count, 1);
  assert.equal(summary.standardBenchmark.bestWpm, 51);
  assert.equal(summary.lessons.bestWpm, 90);
  assert.equal(summary.practice.bestWpm, 42);
  assert.equal(summary.practice.count, 1);
  assert.equal(summary.practical.count, 1);
  assert.equal(summary.numbers.count, 1);
});



test("legacy tests without explicit validation remain practice-only", () => {
  const attempts = [
    { type: "test", testId: "standard-60", netWpm: 72, accuracy: 99, durationSeconds: 60 },
  ];
  const summary = getPerformanceSummary(attempts);
  assert.equal(summary.standardBenchmark.count, 0);
});

test("version 5 diagnostic placement is migrated back to the last directly verified checkpoint", () => {
  const migrated = validateImportedData({
    version: 5,
    adaptive: {
      placement: {
        source: "diagnostic",
        startLessonId: "practical-sentences",
        creditedLessonIds: lessons.slice(0, 23).map((lesson) => lesson.id),
      },
    },
    progress: { activeLessonId: "practical-sentences", completedLessons: [], lessonMastery: {} },
  });
  assert.equal(migrated.version, DATA_VERSION);
  assert.equal(migrated.adaptive.placement.startLessonId, "capital-letters");
  assert.equal(migrated.progress.activeLessonId, "capital-letters");
  assert.ok(!migrated.adaptive.placement.creditedLessonIds.includes("capital-letters"));
  assert.ok(!migrated.adaptive.placement.creditedLessonIds.includes("numbers-dates"));
});
