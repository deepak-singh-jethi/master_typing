import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInputChange,
  buildSessionResult,
  createTypingTelemetry,
  evaluateBenchmarkValidity,
  getTypingMetrics,
  registerPause,
} from "../lib/typingEngine.js";
import { getBenchmarkPolicy, getPracticeAccuracyTarget } from "../lib/sessionRules.js";
import { DATA_VERSION, validateImportedData } from "../lib/storage.js";

function typeSequence(target, entries, options = {}) {
  const telemetry = createTypingTelemetry(target);
  let value = "";
  for (const [character, atMs] of entries) {
    value += character;
    const result = applyInputChange(telemetry, value, atMs, options);
    value = result.acceptedValue;
  }
  return telemetry;
}

test("calculates gross, net, keystroke and final-text metrics separately", () => {
  const telemetry = typeSequence("test", [["t", 0], ["e", 250], ["x", 500], ["t", 750]]);
  const metrics = getTypingMetrics(telemetry, 60000);

  assert.equal(metrics.grossWpm, 0.8);
  assert.equal(metrics.netWpm, 0.6);
  assert.equal(metrics.keystrokeAccuracy, 75);
  assert.equal(metrics.finalTextAccuracy, 75);
  assert.equal(metrics.uncorrectedErrors, 1);
});

test("records expected-to-actual confusion and key latency", () => {
  const telemetry = typeSequence("ab", [["a", 0], ["x", 180]]);
  assert.equal(telemetry.keyStats.b.errors, 1);
  assert.equal(telemetry.keyStats.b.confusions.x, 1);
  assert.equal(telemetry.confusionMatrix.b.x, 1);
  assert.equal(telemetry.keyStats.b.timedAttempts, 1);
  assert.equal(telemetry.keyStats.b.totalLatencyMs, 180);
});

test("records bigram accuracy and transition latency", () => {
  const telemetry = typeSequence("th", [["t", 0], ["h", 140]]);
  assert.equal(telemetry.bigramStats.th.attempts, 1);
  assert.equal(telemetry.bigramStats.th.correct, 1);
  assert.equal(telemetry.bigramStats.th.totalLatencyMs, 140);
});

test("allowed mode handles multi-character deletion as one correction action", () => {
  const telemetry = typeSequence("hello", [["h", 0], ["e", 100], ["x", 200], ["x", 300]]);
  const change = applyInputChange(telemetry, "he", 400, { backspaceMode: "allowed", inputType: "deleteWordBackward" });

  assert.equal(change.acceptedValue, "he");
  assert.equal(telemetry.correctionActions, 1);
  assert.equal(telemetry.deletedCharacters, 2);
  assert.equal(telemetry.correctedErrors, 2);
});

test("errors-only mode deletes only the trailing run of incorrect characters", () => {
  const telemetry = typeSequence("abcde", [["a", 0], ["b", 100], ["c", 200], ["x", 300], ["y", 400]]);
  const change = applyInputChange(telemetry, "", 500, { backspaceMode: "errors-only", inputType: "deleteWordBackward" });

  assert.equal(change.acceptedValue, "abc");
  assert.equal(telemetry.deletedCharacters, 2);
  assert.equal(telemetry.correctedErrors, 2);
  assert.equal(telemetry.rejectedEdits, 1);
});

test("errors-only mode protects a correct trailing character", () => {
  const telemetry = typeSequence("abc", [["a", 0], ["b", 100], ["c", 200]]);
  const change = applyInputChange(telemetry, "ab", 300, { backspaceMode: "errors-only", inputType: "deleteContentBackward" });

  assert.equal(change.acceptedValue, "abc");
  assert.equal(telemetry.deletedCharacters, 0);
});

test("disabled mode rejects deletion", () => {
  const telemetry = typeSequence("abc", [["a", 0], ["b", 100]]);
  const change = applyInputChange(telemetry, "a", 200, { backspaceMode: "disabled" });
  assert.equal(change.acceptedValue, "ab");
  assert.equal(telemetry.rejectedEdits, 1);
});

test("composition commits can insert multiple characters without corrupting text", () => {
  const telemetry = createTypingTelemetry("café");
  applyInputChange(telemetry, "caf", 300);
  const change = applyInputChange(telemetry, "café", 450, {
    inputType: "insertCompositionText",
    isCompositionCommit: true,
  });

  assert.equal(change.acceptedValue, "café");
  assert.equal(telemetry.compositionCommits, 1);
  assert.equal(telemetry.characterInputs, 4);
});

test("a valid full-duration benchmark is personal-best eligible", () => {
  const target = "a".repeat(100);
  const telemetry = createTypingTelemetry(target);
  applyInputChange(telemetry, target, 60000);
  const result = buildSessionResult({
    telemetry,
    elapsedMs: 60000,
    reason: "time",
    benchmarkPolicy: {
      expectedDurationSeconds: 60,
      minimumAccuracy: 90,
      minimumCharacters: 20,
      requireFullDuration: true,
      allowPauses: false,
    },
  });

  assert.equal(result.benchmarkValid, true);
  assert.equal(result.personalBestEligible, true);
});

test("paused benchmarks are saved but cannot set a personal best", () => {
  const target = "a".repeat(100);
  const telemetry = createTypingTelemetry(target);
  applyInputChange(telemetry, target, 60000);
  registerPause(telemetry, "manual");
  const validation = evaluateBenchmarkValidity({
    reason: "time",
    durationSeconds: 60,
    characterInputs: 100,
    keystrokeAccuracy: 100,
    pauseCount: telemetry.pauseCount,
    invalidReasons: [],
    validSession: true,
  }, {
    expectedDurationSeconds: 60,
    minimumAccuracy: 90,
    minimumCharacters: 20,
    requireFullDuration: true,
    allowPauses: false,
  });

  assert.equal(validation.benchmarkValid, false);
  assert.match(validation.validationReasons.join(" "), /Paused benchmark/);
});

test("accuracy-builder target is centralised at 97 percent", () => {
  assert.equal(getPracticeAccuracyTarget({ presetId: "accuracy", contentType: "words" }), 97);
  assert.equal(getPracticeAccuracyTarget({ contentType: "numbers" }), 96);
  assert.equal(getPracticeAccuracyTarget({ contentType: "smart", accuracyTarget: null }), 95);
  assert.equal(getPracticeAccuracyTarget({ contentType: "words" }), 94);
});

test("benchmark policy scales minimum characters by duration", () => {
  const policy = getBenchmarkPolicy({ id: "standard-60", durationSeconds: 60 });
  assert.equal(policy.minimumAccuracy, 90);
  assert.equal(policy.minimumCharacters, 20);
});


test("suffix replacement is handled as deletion plus insertion", () => {
  const telemetry = typeSequence("abcd", [["a", 0], ["b", 100], ["x", 200]]);
  const change = applyInputChange(telemetry, "abc", 350, { backspaceMode: "allowed", inputType: "insertReplacementText" });

  assert.equal(change.acceptedValue, "abc");
  assert.equal(telemetry.correctionActions, 1);
  assert.equal(telemetry.correctedErrors, 1);
  assert.equal(telemetry.characterInputs, 4);
});

test("low-accuracy benchmark is not personal-best eligible", () => {
  const validation = evaluateBenchmarkValidity({
    reason: "time",
    durationSeconds: 60,
    characterInputs: 100,
    keystrokeAccuracy: 80,
    pauseCount: 0,
    invalidReasons: [],
    validSession: true,
  }, {
    expectedDurationSeconds: 60,
    minimumAccuracy: 90,
    minimumCharacters: 20,
    requireFullDuration: true,
    allowPauses: false,
  });

  assert.equal(validation.personalBestEligible, false);
  assert.match(validation.validationReasons.join(" "), /90%/);
});

test("version 3 local data migrates to the phase 4 telemetry shape", () => {
  const migrated = validateImportedData({
    version: 3,
    statistics: { keyStats: { a: { attempts: 10, errors: 1 } } },
    progress: { completedLessons: ["home-f-j"] },
  });

  assert.equal(migrated.version, DATA_VERSION);
  assert.deepEqual(migrated.statistics.bigramStats, {});
  assert.equal(migrated.statistics.keyStats.a.attempts, 10);
});

test("backups from a newer unsupported data version are rejected", () => {
  assert.throws(
    () => validateImportedData({ version: DATA_VERSION + 1 }),
    /newer Typing Master version/i,
  );
});

test("import validation normalises unsafe profile, setting, and custom-text values", () => {
  const imported = validateImportedData({
    version: DATA_VERSION,
    profile: { name: "  A valid learner  ", experience: "skip-foundations", primaryGoal: "unknown" },
    settings: {
      theme: "neon",
      dailyGoalMinutes: 999,
      showKeyboard: "false",
      backspaceMode: "anything",
      textSize: "huge",
    },
    savedCustomTexts: [
      { id: "good", title: " Notes ", text: " useful practice text " },
      { id: "missing-text", title: "Broken" },
      "not-an-object",
    ],
  });

  assert.equal(imported.profile.name, "A valid learner");
  assert.equal(imported.profile.experience, "beginner");
  assert.equal(imported.profile.primaryGoal, "accuracy");
  assert.equal(imported.settings.theme, "system");
  assert.equal(imported.settings.dailyGoalMinutes, 15);
  assert.equal(imported.settings.showKeyboard, true);
  assert.equal(imported.settings.backspaceMode, "allowed");
  assert.equal(imported.settings.textSize, "medium");
  assert.deepEqual(imported.savedCustomTexts.map((item) => item.id), ["good"]);
  assert.equal(imported.savedCustomTexts[0].text, "useful practice text");
});

test("net WPM is based on final correct text and cannot be inflated by retyping", () => {
  const telemetry = createTypingTelemetry("abc");
  applyInputChange(telemetry, "abc", 300);
  applyInputChange(telemetry, "", 600, { backspaceMode: "allowed", inputType: "deleteWordBackward" });
  applyInputChange(telemetry, "abc", 900);
  const metrics = getTypingMetrics(telemetry, 60000);

  assert.equal(metrics.grossWpm, 1.2);
  assert.equal(metrics.netWpm, 0.6);
  assert.equal(metrics.correctCharacters, 3);
});
