import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getLessonById } from "../data/curriculum.js";
import { buildDailyPlan, getEffectiveMasteryState, MASTERY_STATES, upgradeLegacyMastery } from "../lib/adaptiveLearning.js";
import { buildRecoveryConfig, normalisePracticeConfig } from "../lib/practiceRecipes.js";
import { compactAttemptSummary } from "../lib/historyStore.js";
import { toSessionPayload } from "../lib/cloudSync.js";
import {
  applySpacedReviewResult,
  buildSpacedReviewEvidence,
  buildSpacedReviewSessionPlan,
  getSpacedReviewCycleId,
  SPACED_REVIEW_ACCURACY_TARGET,
  SPACED_REVIEW_POLICY_VERSION,
} from "../lib/spacedReview.js";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function dueMastery(overrides = {}) {
  return {
    state: MASTERY_STATES.REVIEW_DUE,
    masteredAt: "2026-08-01T10:00:00.000Z",
    dueAt: "2026-08-13T10:00:00.000Z",
    reviewIntervalDays: 3,
    reviewCount: 0,
    ...overrides,
  };
}

function timing(attempts, errors = 0, latency = 300) {
  return {
    attempts,
    correct: Math.max(0, attempts - errors),
    errors,
    correctedErrors: 0,
    timedAttempts: attempts,
    totalLatencyMs: attempts * latency,
    fastestMs: latency - 30,
    slowestMs: latency + 30,
    confusions: {},
  };
}

function stageResult(stage, overrides = {}) {
  const characters = stage.id === "cold-recall" ? 60 : 120;
  return {
    reason: "time",
    durationSeconds: stage.durationSeconds,
    keystrokeAccuracy: 98,
    finalTextAccuracy: 98,
    accuracy: 98,
    netWpm: 24,
    rawWpm: 26,
    consistency: 74,
    charactersTyped: characters,
    characterInputs: characters,
    correctCharacters: characters - 1,
    errors: 1,
    correctedErrors: 0,
    correctionActions: 0,
    completion: 30,
    validSession: true,
    benchmarkValid: null,
    pauseCount: 0,
    focusLossCount: 0,
    keyStats: {
      r: timing(20, 0),
      u: timing(20, 1),
    },
    bigramStats: {
      ru: timing(12, 0),
      ur: timing(12, 0),
    },
    confusionMatrix: {},
    mistakeWords: [],
    difficultKeys: [],
    difficultBigrams: [],
    ...overrides,
  };
}

function buildEvidence(overrides = {}) {
  const lesson = getLessonById("top-r-u");
  const mastery = dueMastery(overrides.mastery);
  const plan = buildSpacedReviewSessionPlan({ lesson, mastery, seed: 9917 });
  const results = [stageResult(plan.stages[0]), stageResult(plan.stages[1])];
  if (overrides.stage0) results[0] = { ...results[0], ...overrides.stage0 };
  if (overrides.stage1) results[1] = { ...results[1], ...overrides.stage1 };
  const evidence = buildSpacedReviewEvidence({
    lesson,
    mastery,
    plan,
    stageResults: results,
    completedAt: new Date("2026-08-14T10:00:00.000Z"),
  });
  return { lesson, mastery, plan, results, evidence };
}

test("phase 3 passes only a valid full-duration accuracy-first retention check", () => {
  const { evidence } = buildEvidence();
  assert.equal(evidence.reviewPolicyVersion, SPACED_REVIEW_POLICY_VERSION);
  assert.equal(evidence.reviewAccuracyTarget, SPACED_REVIEW_ACCURACY_TARGET);
  assert.equal(evidence.sessionPassed, true);
  assert.equal(evidence.reviewOutcome, "passed");
  assert.equal(evidence.validSession, true);
  assert.equal(evidence.reviewNextIntervalDays, 7);
  assert.equal(evidence.reviewStageEvidence.length, 2);
  assert.ok(evidence.reviewStageEvidence.every((stage) => stage.passed));
});

test("low accuracy, shortened work, and weak focus control each keep a review from passing", () => {
  const lowAccuracy = buildEvidence({ stage0: { keystrokeAccuracy: 93, accuracy: 93 } }).evidence;
  assert.equal(lowAccuracy.sessionPassed, false);
  assert.ok(lowAccuracy.reviewReasons.includes("cold-recall:accuracy"));

  const short = buildEvidence({ stage1: { reason: "text-ended", durationSeconds: 34 } }).evidence;
  assert.equal(short.sessionPassed, false);
  assert.ok(short.reviewReasons.includes("fresh-transfer:duration"));

  const weakFocus = buildEvidence({
    stage0: { keyStats: { r: timing(10, 2), u: timing(10, 0) } },
    stage1: { keyStats: { r: timing(10, 2), u: timing(10, 0) } },
  }).evidence;
  assert.equal(weakFocus.sessionPassed, false);
  assert.ok(weakFocus.reviewReasons.includes("focus-control"));
  assert.ok(weakFocus.reviewFocusErrorRate > 8);
});

test("a successful dedicated review advances 3 to 7 days exactly once", () => {
  const { lesson, mastery, evidence } = buildEvidence();
  const next = applySpacedReviewResult(mastery, evidence, lesson, new Date(evidence.completedAt));
  assert.equal(next.state, MASTERY_STATES.MASTERED);
  assert.equal(next.reviewIntervalDays, 7);
  assert.equal(next.reviewCount, 1);
  assert.equal(next.reviewAttempts, 1);
  assert.equal(next.lastReviewedAt, evidence.completedAt);
  assert.equal(next.lastCompletedReviewCycleId, evidence.reviewCycleId);
  assert.equal(next.lastReviewOutcome, "passed");
  assert.equal(next.dueAt, "2026-08-21T10:00:00.000Z");

  const duplicate = applySpacedReviewResult(next, evidence, lesson, new Date(evidence.completedAt));
  assert.deepEqual(duplicate, next);
});

test("successful reviews advance through 3, 7, 14, 30, 60 and then stay at 60", () => {
  const lesson = getLessonById("top-r-u");
  const expected = new Map([[3, 7], [7, 14], [14, 30], [30, 60], [60, 60]]);
  for (const [interval, nextInterval] of expected) {
    const mastery = dueMastery({ reviewIntervalDays: interval, reviewCount: interval });
    const plan = buildSpacedReviewSessionPlan({ lesson, mastery, seed: 500 + interval });
    const evidence = buildSpacedReviewEvidence({
      lesson,
      mastery,
      plan,
      stageResults: plan.stages.map((stage) => stageResult(stage)),
      completedAt: new Date("2026-08-14T10:00:00.000Z"),
    });
    const next = applySpacedReviewResult(mastery, evidence, lesson, new Date(evidence.completedAt));
    assert.equal(next.reviewIntervalDays, nextInterval, `${interval} should advance to ${nextInterval}`);
  }
});

test("a failed review stays due, does not increment review count, and retains bounded recovery evidence", () => {
  const { lesson, mastery, evidence } = buildEvidence({
    stage1: {
      keystrokeAccuracy: 89,
      accuracy: 89,
      keyStats: { r: timing(12, 3), u: timing(12, 0) },
      bigramStats: { ru: timing(8, 2) },
      confusionMatrix: { r: { t: 2 } },
      mistakeWords: [{ expected: "read", typed: "tead" }],
    },
  });
  const next = applySpacedReviewResult(mastery, evidence, lesson, new Date(evidence.completedAt));
  assert.equal(next.state, MASTERY_STATES.REVIEW_DUE);
  assert.equal(next.reviewIntervalDays, 3);
  assert.equal(next.reviewCount, 0);
  assert.equal(next.reviewAttempts, 1);
  assert.equal(next.lastReviewedAt, undefined);
  assert.equal(next.dueAt, mastery.dueAt);
  assert.equal(next.lastReviewOutcome, "needs-refresh");
  assert.equal(next.lastReviewEvidence.recoveryResult.mistakeWords[0].expected, "read");
  assert.equal(next.lastReviewEvidence.recoveryResult.confusionMatrix.r.t, 2);
});

test("failed review recovery stays inside the source lesson and returns to a fresh review reassessment", () => {
  const { lesson, evidence } = buildEvidence({
    stage1: {
      keystrokeAccuracy: 88,
      accuracy: 88,
      difficultKeys: [{ key: "t", errors: 4 }, { key: "r", errors: 3 }],
      bigramStats: { ru: timing(8, 2) },
      difficultBigrams: [{ key: "rt", errors: 3 }, { key: "ru", errors: 2 }],
      mistakeWords: [{ expected: "read", typed: "tead" }, { expected: "town", typed: "rown" }],
      confusionMatrix: { r: { t: 3 }, t: { r: 2 } },
    },
  });

  const recovery = buildRecoveryConfig(evidence, { category: "general" }, {
    sourceType: "lesson",
    sourceId: lesson.id,
    allowedCharacters: lesson.allowedCharacters,
    returnTarget: {
      kind: "review",
      to: `/review/${lesson.id}/session`,
      label: `${lesson.title} retention check`,
    },
  });

  assert.equal(recovery.remediationSourceType, "lesson");
  assert.equal(recovery.remediationAllowedCharacters, lesson.allowedCharacters);
  assert.ok(recovery.focusKeys.includes("r"));
  assert.ok(!recovery.focusKeys.includes("t"));
  assert.ok(recovery.focusBigrams.includes("ru"));
  assert.ok(!recovery.focusBigrams.includes("rt"));
  assert.deepEqual(recovery.recoveryWords, ["read"]);
  assert.equal(recovery.remediationReturn.kind, "review");
  assert.equal(recovery.remediationReturn.to, `/review/${lesson.id}/session`);

  const normalized = normalisePracticeConfig(recovery);
  assert.equal(normalized.remediationReturn.kind, "review");
});

test("post-recovery reassessment and direct retry use fresh but curriculum-safe review material", () => {
  const lesson = getLessonById("top-r-u");
  const mastery = dueMastery();
  const initial = buildSpacedReviewSessionPlan({ lesson, mastery });
  const reassessmentA = buildSpacedReviewSessionPlan({ lesson, mastery, variantKey: "reassessment:chain-123" });
  const reassessmentB = buildSpacedReviewSessionPlan({ lesson, mastery, variantKey: "reassessment:chain-123" });
  const retry = buildSpacedReviewSessionPlan({ lesson, mastery, variantKey: "retry:attempt-2" });

  assert.notEqual(reassessmentA.stages[0].fingerprint, initial.stages[0].fingerprint);
  assert.notEqual(reassessmentA.stages[1].fingerprint, initial.stages[1].fingerprint);
  assert.equal(reassessmentA.stages[0].fingerprint, reassessmentB.stages[0].fingerprint);
  assert.equal(reassessmentA.stages[1].fingerprint, reassessmentB.stages[1].fingerprint);
  assert.notEqual(retry.stages[1].fingerprint, initial.stages[1].fingerprint);

  for (const plan of [reassessmentA, retry]) {
    assert.ok(plan.stages.every((stage) => [...stage.target].every((character) => lesson.allowedCharacters.includes(character))));
  }
});

test("the dedicated review cycle id is stable until the scheduler actually advances", () => {
  const lesson = getLessonById("top-r-u");
  const mastery = dueMastery();
  const first = getSpacedReviewCycleId({ lesson, mastery });
  assert.equal(first, getSpacedReviewCycleId({ lesson, mastery: { ...mastery, lastPractisedAt: "2026-08-14T10:00:00.000Z" } }));
  assert.notEqual(first, getSpacedReviewCycleId({
    lesson,
    mastery: { ...mastery, dueAt: "2026-08-21T10:00:00.000Z", reviewCount: 1, reviewIntervalDays: 7 },
  }));
});

test("daily plan recognises one completed dedicated review instead of demanding the old lesson exercises", () => {
  const today = "2026-08-14T10:00:00.000Z";
  const data = {
    profile: { experience: "beginner", primaryGoal: "accuracy" },
    settings: { dailyGoalMinutes: 10 },
    adaptive: { placement: { creditedLessonIds: [], startLessonId: "home-f-j" } },
    progress: {
      activeLessonId: "home-d-k",
      completedLessons: ["home-f-j"],
      lessonMastery: {
        "home-f-j": {
          state: MASTERY_STATES.MASTERED,
          masteredAt: "2026-08-01T10:00:00.000Z",
          lastPractisedAt: today,
          lastReviewedAt: today,
          dueAt: "2026-08-21T10:00:00.000Z",
          reviewIntervalDays: 7,
          reviewCount: 1,
        },
      },
    },
    statistics: { keyStats: {}, bigramStats: {}, wordStats: {}, dailyActivity: {} },
    attempts: [{
      type: "spaced-review",
      lessonId: "home-f-j",
      reviewAttempt: true,
      sessionPassed: true,
      validSession: true,
      accuracy: 98,
      keystrokeAccuracy: 98,
      durationSeconds: 90,
      completedAt: today,
    }],
  };
  const plan = buildDailyPlan(data, new Date("2026-08-14T11:00:00.000Z"));
  const reviewItem = plan.items.find((item) => item.type === "review");
  assert.ok(reviewItem);
  assert.equal(reviewItem.to, "/review/home-f-j");
  assert.equal(reviewItem.done, true);
});



test("a stale review result cannot advance a newer due cycle", () => {
  const { lesson, mastery, evidence } = buildEvidence();
  const newerCycle = {
    ...mastery,
    dueAt: "2026-08-20T10:00:00.000Z",
    reviewIntervalDays: 7,
    reviewCount: 1,
  };
  const unchanged = applySpacedReviewResult(newerCycle, evidence, lesson, new Date("2026-08-20T10:00:00.000Z"));
  assert.deepEqual(unchanged, newerCycle);
});

test("failed review evidence survives local mastery normalization and remains due after reload", () => {
  const { lesson, mastery, evidence } = buildEvidence({
    stage1: {
      keystrokeAccuracy: 90,
      accuracy: 90,
      mistakeWords: [{ expected: "read", typed: "reaf" }],
    },
  });
  const failed = applySpacedReviewResult(mastery, evidence, lesson, new Date(evidence.completedAt));
  const reloaded = upgradeLegacyMastery(failed, lesson.id, true, new Date("2026-08-15T10:00:00.000Z"));

  assert.equal(reloaded.dueAt, mastery.dueAt);
  assert.equal(reloaded.reviewCount, 0);
  assert.equal(reloaded.lastReviewOutcome, "needs-refresh");
  assert.equal(reloaded.lastReviewEvidence.recoveryResult.mistakeWords[0].expected, "read");
  assert.equal(getEffectiveMasteryState(reloaded, new Date("2026-08-15T10:00:00.000Z")), MASTERY_STATES.REVIEW_DUE);
});

test("compact local history and cloud metadata preserve dedicated review identity without typed content", () => {
  const { evidence } = buildEvidence();
  const attempt = {
    ...evidence,
    id: "review-attempt-1",
    typedText: "must-not-persist",
  };
  const compact = compactAttemptSummary(attempt);
  assert.equal(compact.type, "spaced-review");
  assert.equal(compact.reviewCycleId, evidence.reviewCycleId);
  assert.equal(compact.reviewOutcome, "passed");
  assert.equal(compact.reviewPolicyVersion, SPACED_REVIEW_POLICY_VERSION);
  assert.equal(compact.typedText, undefined);

  const payload = toSessionPayload(compact, "user-1");
  assert.equal(payload.mode, "spaced-review");
  assert.equal(payload.metadata.reviewCycleId, evidence.reviewCycleId);
  assert.equal(payload.metadata.reviewOutcome, "passed");
  assert.equal(payload.metadata.sessionPassed, true);
  assert.equal(JSON.stringify(payload).includes("must-not-persist"), false);
});

test("UI integration records the dedicated result, offers targeted recovery, and keeps full-lesson replay separate", () => {
  const reviewSession = source("pages/ReviewSessionPage.jsx");
  const reviewPage = source("pages/ReviewPage.jsx");
  const practiceSession = source("pages/PracticeSessionPage.jsx");
  const lessonPage = source("pages/LessonPage.jsx");
  const provider = source("context/AppProvider.jsx");
  const coaching = source("lib/resultCoaching.js");

  assert.match(reviewSession, /buildSpacedReviewEvidence/);
  assert.match(reviewSession, /reassessment:\$\{remediation\.chainId/);
  assert.match(reviewSession, /recordSession\(reviewResult\)/);
  assert.match(reviewPage, /Practice weak movements/);
  assert.match(reviewPage, /reviewVariant/);
  assert.match(reviewPage, /kind: "review"/);
  assert.match(practiceSession, /\["test", "lesson", "review"\]\.includes\(target\?\.kind\)/);
  assert.match(lessonPage, /const reviewAttempt = false/);
  assert.match(provider, /Only the dedicated review flow is allowed to move the retention schedule/);
  assert.match(provider, /session\.type === "spaced-review"/);
  assert.doesNotMatch(coaching, /handled in the next review phase/);
  assert.match(coaching, /combined review result/);
});
