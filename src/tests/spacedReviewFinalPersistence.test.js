import test from "node:test";
import assert from "node:assert/strict";
import { lessons, getLessonById } from "../data/curriculum.js";
import {
  getNextRecommendedLesson,
  getReviewQueue,
  MASTERY_STATES,
} from "../lib/adaptiveLearning.js";
import { getDashboardReviewAction, getPrimaryDashboardAction } from "../lib/uiExperience.js";
import {
  createFreshAppData,
  loadAppData,
  saveAppData,
} from "../lib/storage.js";
import { mergeAccountLocalData } from "../lib/cloudSync.js";
import {
  applySpacedReviewResult,
  buildSpacedReviewEvidence,
  buildSpacedReviewSessionPlan,
} from "../lib/spacedReview.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

function timing(attempts, errors = 0, latency = 260) {
  return {
    attempts,
    correct: Math.max(0, attempts - errors),
    errors,
    correctedErrors: 0,
    timedAttempts: attempts,
    totalLatencyMs: attempts * latency,
    fastestMs: Math.max(1, latency - 30),
    slowestMs: latency + 30,
    confusions: {},
  };
}

function dueMastery(overrides = {}) {
  return {
    state: MASTERY_STATES.REVIEW_DUE,
    masteredAt: "2026-08-01T10:00:00.000Z",
    dueAt: "2026-08-13T10:00:00.000Z",
    reviewDueAt: "2026-08-13T10:00:00.000Z",
    reviewIntervalDays: 3,
    reviewCount: 0,
    ...overrides,
  };
}

function passingStageResult(stage, focusKeys = ["f", "j"]) {
  const characters = stage.id === "cold-recall" ? 60 : 120;
  return {
    reason: "time",
    durationSeconds: stage.durationSeconds,
    keystrokeAccuracy: 98,
    finalTextAccuracy: 98,
    accuracy: 98,
    netWpm: 24,
    rawWpm: 26,
    consistency: 78,
    charactersTyped: characters,
    characterInputs: characters,
    correctCharacters: characters - 1,
    errors: 1,
    correctedErrors: 0,
    correctionActions: 0,
    validSession: true,
    benchmarkValid: null,
    pauseCount: 0,
    focusLossCount: 0,
    keyStats: Object.fromEntries(focusKeys.map((key, index) => [key, timing(24, index === 0 ? 1 : 0)])),
    bigramStats: {},
    confusionMatrix: {},
    mistakeWords: [],
  };
}

function passReview(lessonId = "home-f-j", mastery = dueMastery(), completedAt = "2026-08-14T10:00:00.000Z") {
  const lesson = getLessonById(lessonId);
  const literalFocus = (lesson.focusKeys ?? []).filter((key) => key.length === 1 && key !== " ");
  const focusKeys = literalFocus.length ? literalFocus : ["f", "j"];
  const plan = buildSpacedReviewSessionPlan({ lesson, mastery, seed: 20260814 });
  const evidence = buildSpacedReviewEvidence({
    lesson,
    mastery,
    plan,
    stageResults: plan.stages.map((stage) => passingStageResult(stage, focusKeys)),
    completedAt: new Date(completedAt),
  });
  assert.equal(evidence.sessionPassed, true, `fixture for ${lessonId} must pass`);
  const updated = applySpacedReviewResult(mastery, evidence, lesson, new Date(completedAt));
  return { lesson, evidence, updated };
}

function learnerAtRU(homeFJMastery) {
  const data = createFreshAppData();
  data.onboarding.completed = true;
  data.progress.activeLessonId = "top-r-u";
  data.progress.completedLessons = lessons.slice(0, 7).map((lesson) => lesson.id);
  data.progress.lessonMastery = {
    ...data.progress.lessonMastery,
    "home-f-j": homeFJMastery,
  };
  return data;
}

test("passing the due F/J review removes that exact review from Today immediately", () => {
  const now = new Date("2026-08-14T10:01:00.000Z");
  const original = dueMastery();
  const before = learnerAtRU(original);
  assert.deepEqual(getReviewQueue(before, now).map((item) => item.lessonId), ["home-f-j"]);

  const { updated } = passReview("home-f-j", original);
  const after = learnerAtRU(updated);
  const queue = getReviewQueue(after, now);

  assert.deepEqual(queue, []);
  assert.equal(updated.state, MASTERY_STATES.MASTERED);
  assert.equal(updated.reviewIntervalDays, 7);
  assert.equal(updated.reviewCount, 1);
  assert.equal(updated.dueAt, "2026-08-21T10:00:00.000Z");
});

test("after a pass the Home primary action returns to R/U instead of showing F/J again", () => {
  const now = new Date("2026-08-14T10:01:00.000Z");
  const { updated } = passReview("home-f-j");
  const data = learnerAtRU(updated);
  const reviewQueue = getReviewQueue(data, now);
  const nextLesson = getNextRecommendedLesson(data);
  const action = getPrimaryDashboardAction({
    onboardingCompleted: data.onboarding.completed,
    reviewQueue,
    nextLesson,
  });

  assert.equal(reviewQueue.length, 0);
  assert.equal(nextLesson?.id, "top-r-u");
  assert.equal(action.kind, "lesson");
  assert.equal(action.to, "/learn/top-r-u");
  assert.equal(action.title, getLessonById("top-r-u").title);
});

test("a successful review survives local save + browser-style reload and does not become due again", () => {
  const storage = memoryStorage();
  const { updated } = passReview("home-f-j");
  const data = learnerAtRU(updated);

  assert.equal(saveAppData(data, null, storage), true);
  const reloaded = loadAppData(null, storage);
  const savedMastery = reloaded.progress.lessonMastery["home-f-j"];

  assert.equal(savedMastery.state, MASTERY_STATES.MASTERED);
  assert.equal(savedMastery.reviewCount, 1);
  assert.equal(savedMastery.reviewIntervalDays, 7);
  assert.equal(savedMastery.lastReviewOutcome, "passed");
  assert.equal(savedMastery.lastReviewedAt, "2026-08-14T10:00:00.000Z");
  assert.equal(savedMastery.dueAt, "2026-08-21T10:00:00.000Z");
  assert.deepEqual(
    getReviewQueue(reloaded, new Date("2026-08-14T18:00:00.000Z")).map((item) => item.lessonId),
    [],
  );
});

test("the passed review returns only when its newly scheduled future due date actually arrives", () => {
  const { updated } = passReview("home-f-j");
  const data = learnerAtRU(updated);

  assert.deepEqual(getReviewQueue(data, new Date("2026-08-20T23:59:59.000Z")), []);
  assert.deepEqual(
    getReviewQueue(data, new Date("2026-08-21T10:00:00.000Z")).map((item) => item.lessonId),
    ["home-f-j"],
  );
});

test("saving and reloading a failed review intentionally keeps the same review due", () => {
  const storage = memoryStorage();
  const lesson = getLessonById("home-f-j");
  const mastery = dueMastery();
  const plan = buildSpacedReviewSessionPlan({ lesson, mastery, seed: 7701 });
  const stageResults = plan.stages.map((stage) => passingStageResult(stage, ["f", "j"]));
  stageResults[1] = {
    ...stageResults[1],
    keystrokeAccuracy: 88,
    accuracy: 88,
  };
  const evidence = buildSpacedReviewEvidence({
    lesson,
    mastery,
    plan,
    stageResults,
    completedAt: new Date("2026-08-14T10:00:00.000Z"),
  });
  assert.equal(evidence.sessionPassed, false);

  const failed = applySpacedReviewResult(mastery, evidence, lesson, new Date(evidence.completedAt));
  const data = learnerAtRU(failed);
  assert.equal(saveAppData(data, null, storage), true);
  const reloaded = loadAppData(null, storage);

  assert.equal(reloaded.progress.lessonMastery["home-f-j"].lastReviewOutcome, "needs-refresh");
  assert.deepEqual(
    getReviewQueue(reloaded, new Date("2026-08-14T10:01:00.000Z")).map((item) => item.lessonId),
    ["home-f-j"],
  );
});

test("a stale cloud/device review-due record cannot resurrect a review that was already passed", () => {
  const { updated } = passReview("home-f-j");
  const passedDevice = learnerAtRU(updated);
  const staleDevice = learnerAtRU(dueMastery({
    lastPractisedAt: "2026-08-13T10:00:00.000Z",
  }));

  const merged = mergeAccountLocalData(staleDevice, passedDevice, { preferLatestSnapshot: true });
  const mastery = merged.progress.lessonMastery["home-f-j"];

  assert.equal(mastery.state, MASTERY_STATES.MASTERED);
  assert.equal(mastery.reviewCount, 1);
  assert.equal(mastery.reviewIntervalDays, 7);
  assert.equal(mastery.dueAt, "2026-08-21T10:00:00.000Z");
  assert.deepEqual(getReviewQueue(merged, new Date("2026-08-14T11:00:00.000Z")), []);
});

test("re-applying the same successful cycle is idempotent and cannot reschedule it twice", () => {
  const mastery = dueMastery();
  const { lesson, evidence, updated } = passReview("home-f-j", mastery);
  const replayed = applySpacedReviewResult(updated, evidence, lesson, new Date(evidence.completedAt));

  assert.deepEqual(replayed, updated);
  assert.equal(replayed.reviewCount, 1);
  assert.equal(replayed.reviewIntervalDays, 7);
  assert.equal(replayed.dueAt, "2026-08-21T10:00:00.000Z");
});

test("if another different lesson is due, Today may show that next review but never the completed F/J cycle", () => {
  const { updated } = passReview("home-f-j");
  const data = learnerAtRU(updated);
  data.progress.lessonMastery["home-d-k"] = dueMastery({
    masteredAt: "2026-08-02T10:00:00.000Z",
    dueAt: "2026-08-14T09:00:00.000Z",
    reviewDueAt: "2026-08-14T09:00:00.000Z",
  });

  const queue = getReviewQueue(data, new Date("2026-08-14T10:01:00.000Z"));
  assert.deepEqual(queue.map((item) => item.lessonId), ["home-d-k"]);

  const lessonAction = getPrimaryDashboardAction({
    onboardingCompleted: true,
    nextLesson: getNextRecommendedLesson(data),
  });
  const reviewAction = getDashboardReviewAction(queue);

  assert.equal(lessonAction.kind, "lesson");
  assert.equal(lessonAction.to, "/learn/top-r-u");
  assert.equal(reviewAction.kind, "review");
  assert.equal(reviewAction.to, "/review/home-d-k");
  assert.notEqual(reviewAction.to, "/review/home-f-j");
});
