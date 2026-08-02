import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyGuidedLessonResult,
  assessGuidedAttempt,
  getGuidedExerciseRequirements,
  MASTERY_RULE_VERSION,
  MASTERY_STATES,
} from "../lib/adaptiveLearning.js";
import { getLessonById, lessons } from "../data/curriculum.js";
import { generateGuidedLessonExercise } from "../data/contentBank.js";
import { mergeAccountLocalData } from "../lib/cloudSync.js";
import { getPrimaryDiagnosis } from "../lib/resultCoaching.js";
import { createFreshAppData } from "../lib/storage.js";

function modernResult(lesson, exercise, fingerprint, overrides = {}) {
  return {
    exerciseId: exercise.id,
    accuracy: 98,
    keystrokeAccuracy: 98,
    netWpm: 28,
    consistency: 76,
    completion: 100,
    validSession: true,
    keyStats: {},
    masteryRuleVersion: MASTERY_RULE_VERSION,
    contentVersion: exercise.contentVersion,
    contentFingerprint: fingerprint,
    unseenTransfer: exercise.stage === "transfer",
    guidedStage: exercise.stage,
    ...overrides,
  };
}

test("modern guided requirements are stage-specific and do not impose an early speed gate", () => {
  const lesson = getLessonById("home-f-j");
  const [focus, control, transfer] = lesson.exercises.map((exercise) => getGuidedExerciseRequirements(lesson, exercise));
  assert.equal(focus.accuracy, 96);
  assert.equal(focus.maximumFocusErrorRate, 4);
  assert.equal(control.accuracy, 95);
  assert.equal(control.maximumFocusErrorRate, 6);
  assert.equal(transfer.accuracy, 95);
  assert.equal(transfer.maximumFocusErrorRate, 8);
  assert.equal(transfer.requiresUnseenText, true);
  assert.equal("minimumWpm" in focus, false);
});

test("focus-key control can block a pass even when overall accuracy is high", () => {
  const lesson = getLessonById("home-f-j");
  const exercise = lesson.exercises[0];
  const result = modernResult(lesson, exercise, "focus-control-test", {
    keystrokeAccuracy: 98,
    keyStats: {
      f: { attempts: 50, errors: 5 },
      j: { attempts: 50, errors: 0 },
    },
  });
  const assessment = assessGuidedAttempt(result, lesson, exercise);
  assert.equal(assessment.focusErrorRate, 5);
  assert.equal(assessment.passed, false);
  assert.ok(assessment.reasons.includes("focus-control"));
});

test("capital-letter focus uses uppercase telemetry rather than the letters in the word Shift", () => {
  const lesson = getLessonById("capital-letters");
  const exercise = lesson.exercises[0];
  const assessment = assessGuidedAttempt(modernResult(lesson, exercise, "capital-focus", {
    keyStats: {
      A: { attempts: 20, errors: 2 },
      R: { attempts: 20, errors: 0 },
      s: { attempts: 100, errors: 0 },
      h: { attempts: 100, errors: 0 },
    },
  }), lesson, exercise);
  assert.equal(assessment.focusErrorRate, 5);
  assert.equal(assessment.passed, false);
});

test("a modern transfer check requires current fresh generated content", () => {
  const lesson = getLessonById("home-f-j");
  const exercise = lesson.exercises[2];
  const missing = assessGuidedAttempt(
    modernResult(lesson, exercise, "", { unseenTransfer: true }),
    lesson,
    exercise,
  );
  assert.equal(missing.passed, false);
  assert.ok(missing.reasons.includes("unseen-transfer"));

  const stale = assessGuidedAttempt(
    modernResult(lesson, exercise, "transfer-a", { contentVersion: exercise.contentVersion - 1 }),
    lesson,
    exercise,
  );
  assert.equal(stale.passed, false);

  const fresh = assessGuidedAttempt(modernResult(lesson, exercise, "transfer-a"), lesson, exercise);
  assert.equal(fresh.passed, true);
  assert.equal(fresh.unseenTransfer, true);
});

test("a failed transfer fingerprint cannot later pass as an unseen check", () => {
  const lesson = getLessonById("home-f-j");
  const exercise = lesson.exercises[2];
  let mastery = applyGuidedLessonResult(
    {},
    modernResult(lesson, exercise, "attempted-text", { keystrokeAccuracy: 80, accuracy: 80 }),
    lesson,
    { now: "2026-08-01T10:00:00.000Z" },
  );
  assert.equal(mastery.exerciseResults[exercise.id].passed, false);
  assert.deepEqual(mastery.exerciseResults[exercise.id].attemptedFingerprints, ["attempted-text"]);

  mastery = applyGuidedLessonResult(
    mastery,
    modernResult(lesson, exercise, "attempted-text"),
    lesson,
    { now: "2026-08-01T10:05:00.000Z" },
  );
  assert.equal(mastery.exerciseResults[exercise.id].passed, false);
  assert.ok(mastery.recentAttempts.at(-1).passReasons.includes("unseen-transfer"));

  mastery = applyGuidedLessonResult(
    mastery,
    modernResult(lesson, exercise, "fresh-text"),
    lesson,
    { now: "2026-08-01T10:10:00.000Z" },
  );
  assert.equal(mastery.exerciseResults[exercise.id].passed, true);
  assert.equal(mastery.exerciseResults[exercise.id].unseenPassed, true);
});

test("three valid modern stages can still master a lesson without a WPM requirement", () => {
  const lesson = getLessonById("home-f-j");
  let mastery = {};
  lesson.exercises.forEach((exercise, index) => {
    mastery = applyGuidedLessonResult(
      mastery,
      modernResult(lesson, exercise, `modern-${exercise.id}`, { netWpm: 8 }),
      lesson,
      { now: new Date(Date.UTC(2026, 7, 1, 11, index, 0)), baselineWpm: 40 },
    );
  });
  assert.equal(mastery.state, MASTERY_STATES.MASTERED);
  assert.equal(mastery.exerciseResults.space.unseenPassed, true);
});

test("each course module ends with a generated cumulative review checkpoint", () => {
  const checkpoints = lessons.filter((lesson) => lesson.moduleCheckpoint);
  assert.deepEqual(checkpoints.map((lesson) => lesson.id), [
    "home-row-fluency",
    "top-row-fluency",
    "alphabet-fluency",
    "transition-control",
    "foundation-assessment",
  ]);
  for (const lesson of checkpoints) {
    const exercise = lesson.exercises.find((item) => item.cumulativeReview);
    assert.ok(exercise, `${lesson.id} needs a cumulative exercise`);
    assert.equal(exercise.stage, "transfer");
    const generated = generateGuidedLessonExercise({ lessonId: lesson.id, exerciseId: exercise.id, seed: 42 });
    assert.equal(generated.metadata.reviewScope, "module");
    assert.equal(generated.metadata.checkpointModuleId, lesson.moduleId);
    assert.equal(generated.metadata.guidedQuality.valid, true);
    assert.ok([...generated.text].every((character) => lesson.allowedCharacters.includes(character)));
  }
});

test("legacy guided evidence remains accepted for compatibility", () => {
  const lesson = getLessonById("home-f-j");
  const transfer = lesson.exercises[2];
  const legacy = assessGuidedAttempt({
    exerciseId: transfer.id,
    keystrokeAccuracy: 96,
    completion: 100,
    validSession: true,
  }, lesson, transfer);
  assert.equal(legacy.passed, true);
  assert.equal(legacy.masteryRuleVersion, 1);
});

test("cross-device mastery merge preserves fresh-transfer fingerprints and evidence", () => {
  const first = createFreshAppData();
  const second = createFreshAppData();
  first.progress.lessonMastery["home-f-j"] = {
    exerciseResults: {
      space: {
        attempts: 1,
        attemptedFingerprints: ["device-a"],
        unseenPassed: false,
        masteryRuleVersion: MASTERY_RULE_VERSION,
      },
    },
  };
  second.progress.lessonMastery["home-f-j"] = {
    exerciseResults: {
      space: {
        attempts: 1,
        passed: true,
        attemptedFingerprints: ["device-b"],
        unseenPassed: true,
        masteryRuleVersion: MASTERY_RULE_VERSION,
      },
    },
  };
  const merged = mergeAccountLocalData(first, second).progress.lessonMastery["home-f-j"].exerciseResults.space;
  assert.deepEqual(new Set(merged.attemptedFingerprints), new Set(["device-a", "device-b"]));
  assert.equal(merged.unseenPassed, true);
  assert.equal(merged.passed, true);
});

test("guided failures recommend fresh evidence and the lesson flow enforces it", () => {
  const diagnosis = getPrimaryDiagnosis({
    result: { keystrokeAccuracy: 98, completion: 100, validSession: true, consistency: 80 },
    passed: false,
    passAccuracy: 95,
    requireComplete: true,
    resultContext: { purpose: "guided", guidedStage: "transfer", requiresFreshRetry: true },
  });
  assert.equal(diagnosis.code, "transfer-control");
  assert.match(diagnosis.action, /fresh target/i);

  const lessonPage = readFileSync(new URL("../pages/LessonPage.jsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/typing/TypingWorkspace.jsx", import.meta.url), "utf8");
  assert.match(lessonPage, /onResultRetry=\{practiceMode === "guided" \? generateFreshGuidedText/);
  assert.match(lessonPage, /retryLabel=\{practiceMode === "guided" \? "Try fresh text"/);
  assert.match(workspace, /resultPassEvaluator\(session\.result\)/);
});
