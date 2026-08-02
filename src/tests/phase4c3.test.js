import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionComparison,
  getComparableSessionKey,
  getLessonMasteryBlockers,
  getPrimaryDiagnosis,
  summariseMasteryBlockers,
} from "../lib/resultCoaching.js";
import { buildRecoveryConfig, normalisePracticeConfig } from "../lib/practiceRecipes.js";

test("result diagnosis chooses one highest-priority problem", () => {
  const invalid = getPrimaryDiagnosis({
    result: { validSession: false, validationReasons: ["The session was paused too long."], completion: 100, keystrokeAccuracy: 99 },
    passed: false,
    passAccuracy: 95,
    requireComplete: true,
  });
  assert.equal(invalid.code, "invalid");

  const incomplete = getPrimaryDiagnosis({
    result: { validSession: true, benchmarkValid: true, completion: 72, keystrokeAccuracy: 99, consistency: 80 },
    passed: false,
    passAccuracy: 95,
    requireComplete: true,
  });
  assert.equal(incomplete.code, "completion");

  const inaccurate = getPrimaryDiagnosis({
    result: { validSession: true, benchmarkValid: true, completion: 100, keystrokeAccuracy: 89, consistency: 80, mistakeWords: [{ expected: "their" }] },
    passed: false,
    passAccuracy: 95,
    requireComplete: true,
  });
  assert.equal(inaccurate.code, "accuracy");
  assert.match(inaccurate.action, /mistake-recovery/i);
});

test("valid successful recovery receives a transfer-focused diagnosis", () => {
  const diagnosis = getPrimaryDiagnosis({
    result: { validSession: true, benchmarkValid: true, completion: 100, keystrokeAccuracy: 98, consistency: 75, netWpm: 36, correctionRate: 2 },
    passed: true,
    passAccuracy: 96,
    requireComplete: false,
    resultContext: { purpose: "recovery" },
  });
  assert.equal(diagnosis.code, "recovery-pass");
  assert.match(diagnosis.action, /original session type/i);
});

test("same-mode comparison ignores unrelated attempts", () => {
  const currentMeta = {
    type: "practice",
    contentType: "documents",
    practicePurpose: "balanced",
    goalType: "time",
    plannedDurationSeconds: 300,
    category: "work",
    documentStyle: "email",
  };
  const attempts = [
    {
      id: "wrong-category",
      completedAt: "2026-08-01T10:30:00.000Z",
      type: "practice",
      contentType: "documents",
      practicePurpose: "balanced",
      goalType: "time",
      plannedDurationSeconds: 300,
      category: "government",
      documentStyle: "government",
      netWpm: 90,
      accuracy: 99,
      consistency: 99,
      completion: 100,
    },
    {
      id: "matching",
      completedAt: "2026-08-01T10:00:00.000Z",
      ...currentMeta,
      netWpm: 40,
      accuracy: 94,
      consistency: 62,
      completion: 100,
    },
  ];
  const comparison = buildSessionComparison({ netWpm: 44, keystrokeAccuracy: 96, consistency: 68, completion: 100 }, attempts, currentMeta);
  assert.equal(comparison.previous.id, "matching");
  assert.equal(comparison.metrics.netWpm.delta, 4);
  assert.equal(comparison.metrics.accuracy.delta, 2);
  assert.match(comparison.headline, /Faster and more accurate/i);
});

test("comparison keys separate different practice difficulties and feature policies", () => {
  const base = { type: "practice", contentType: "words", practicePurpose: "balanced", goalType: "time", plannedDurationSeconds: 300, category: "general" };
  assert.notEqual(
    getComparableSessionKey({ ...base, difficulty: "easy" }),
    getComparableSessionKey({ ...base, difficulty: "hard" }),
  );
  assert.notEqual(
    getComparableSessionKey({ ...base, difficulty: "balanced", progressiveFeatures: false }),
    getComparableSessionKey({ ...base, difficulty: "balanced", progressiveFeatures: true }),
  );
});

test("comparison keys separate word-count and timed practice", () => {
  const timed = getComparableSessionKey({ type: "practice", contentType: "words", practicePurpose: "accuracy", goalType: "time", plannedDurationSeconds: 180, category: "general" });
  const words = getComparableSessionKey({ type: "practice", contentType: "words", practicePurpose: "accuracy", goalType: "words", wordCount: 180, category: "general" });
  assert.notEqual(timed, words);
});

test("lesson mastery blockers explain every unmet requirement", () => {
  const lesson = {
    passAccuracy: 94,
    exercises: [{ id: "one" }, { id: "two" }, { id: "three" }],
  };
  const mastery = {
    exerciseResults: { one: { passed: true }, two: { passed: true } },
    successfulAttempts: 2,
    averageAccuracy: 91,
    averageConsistency: 34,
    focusErrorRate: 18,
    masteryScore: 65,
  };
  const blockers = getLessonMasteryBlockers(mastery, lesson);
  const summary = summariseMasteryBlockers(blockers);
  assert.equal(blockers.length, 6);
  assert.equal(summary.complete, false);
  assert.equal(summary.remaining.length, 6);
  assert.equal(summary.next.id, "exercises");
  assert.match(summary.next.detail, /1 exercise/i);
  assert.equal(blockers.find((item) => item.id === "accuracy").target, 94);
  assert.equal(blockers.find((item) => item.id === "score").target, 72);
});

test("review mastery only requires the current review exercise set", () => {
  const lesson = { passAccuracy: 94, exercises: [{ id: "one" }, { id: "two" }] };
  const blockers = getLessonMasteryBlockers({ reviewExerciseResults: { one: { passed: true }, two: { passed: true } } }, lesson, { review: true });
  assert.equal(blockers.length, 1);
  assert.equal(summariseMasteryBlockers(blockers).complete, true);
});

test("custom session goals are safely bounded", () => {
  const maximum = normalisePracticeConfig({ durationSeconds: 9000, wordCount: 9000 });
  assert.equal(maximum.durationSeconds, 3600);
  assert.equal(maximum.wordCount, 5000);
  const minimum = normalisePracticeConfig({ durationSeconds: 1, wordCount: 1 });
  assert.equal(minimum.durationSeconds, 15);
  assert.equal(minimum.wordCount, 10);
});

test("exact mistake recovery keeps words, bigrams, confusions, and keys together", () => {
  const config = buildRecoveryConfig({
    difficultKeys: [{ key: "g" }, { key: "h" }],
    difficultBigrams: [{ key: "gh" }, { key: "th" }],
    mistakeWords: [{ expected: "thought" }, { expected: "through" }, { expected: "though" }],
    confusionMatrix: { g: { h: 4 }, h: { j: 2 } },
  }, { category: "study" });
  assert.deepEqual(config.focusKeys, ["g", "h"]);
  assert.deepEqual(config.focusBigrams, ["gh", "th"]);
  assert.deepEqual(config.recoveryWords, ["thought", "through", "though"]);
  assert.deepEqual(config.confusionPairs.map((item) => [item.expected, item.actual, item.count]), [["g", "h", 4], ["h", "j", 2]]);
  assert.equal(config.targetDensity, 0.58);
});
