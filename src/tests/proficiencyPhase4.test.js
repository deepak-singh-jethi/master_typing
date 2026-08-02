import test from "node:test";
import assert from "node:assert/strict";
import { testPresets } from "../data/practicePresets.js";
import { compactAttemptSummary } from "../lib/historyStore.js";
import { getPerformanceSummary } from "../lib/performance.js";
import {
  PROFICIENCY_STANDARD_VERSION,
  buildProficiencyAttemptFields,
  classifyCourseProficiency,
  getProficiencySummary,
} from "../lib/proficiency.js";
import { getBenchmarkPolicy } from "../lib/sessionRules.js";
import { toSessionPayload } from "../lib/cloudSync.js";

function validResult(overrides = {}) {
  return {
    netWpm: 42,
    accuracy: 97,
    keystrokeAccuracy: 97,
    durationSeconds: 180,
    benchmarkValid: true,
    personalBestEligible: true,
    validSession: true,
    ...overrides,
  };
}

test("one-minute checks provide estimates without recording an official level", () => {
  const classification = classifyCourseProficiency(
    validResult({ durationSeconds: 60, netWpm: 58 }),
    { mode: "estimate", maxLevelId: "functional" },
  );
  const fields = buildProficiencyAttemptFields(classification);

  assert.equal(classification.levelId, "functional");
  assert.equal(classification.official, false);
  assert.equal(fields.proficiencyEligible, false);
  assert.equal(fields.proficiencyLevelId, null);
  assert.equal(fields.estimatedProficiencyLevelId, "functional");
});

test("three-minute assessments can record Foundation or Functional but not Proficient", () => {
  const high = classifyCourseProficiency(
    validResult({ durationSeconds: 180, netWpm: 70, keystrokeAccuracy: 99 }),
    { mode: "level", maxLevelId: "functional" },
  );
  const foundation = classifyCourseProficiency(
    validResult({ durationSeconds: 180, netWpm: 33, keystrokeAccuracy: 95 }),
    { mode: "level", maxLevelId: "functional" },
  );

  assert.equal(high.levelId, "functional");
  assert.equal(foundation.levelId, "foundation");
});

test("five-minute assessment records Proficient only when pace and accuracy both qualify", () => {
  const proficient = classifyCourseProficiency(
    validResult({ durationSeconds: 300, netWpm: 55, keystrokeAccuracy: 97 }),
    { mode: "level", maxLevelId: "proficient" },
  );
  const accuracyLimited = classifyCourseProficiency(
    validResult({ durationSeconds: 300, netWpm: 80, keystrokeAccuracy: 94 }),
    { mode: "level", maxLevelId: "proficient" },
  );

  assert.equal(proficient.levelId, "proficient");
  assert.equal(accuracyLimited.paceBand.id, "proficient");
  assert.equal(accuracyLimited.accuracyBand.id, "developing");
  assert.equal(accuracyLimited.levelId, "developing");
});

test("invalid or interrupted assessments never receive a level", () => {
  const classification = classifyCourseProficiency(
    validResult({ benchmarkValid: false, personalBestEligible: false }),
    { mode: "level", maxLevelId: "functional" },
  );
  assert.equal(classification.valid, false);
  assert.equal(classification.levelId, null);
  assert.equal(buildProficiencyAttemptFields(classification).proficiencyEligible, false);
});

test("proficiency summaries ignore quick estimates and legacy unversioned scores", () => {
  const attempts = [
    { type: "test", testId: "standard-60", benchmarkValid: true, personalBestEligible: true, validSession: true, estimatedProficiencyLevelId: "functional" },
    { type: "test", testId: "endurance-300", benchmarkValid: true, personalBestEligible: true, validSession: true, proficiencyEligible: true, proficiencyLevelId: "proficient" },
    { type: "test", testId: "consistency-180", benchmarkValid: true, personalBestEligible: true, validSession: true, proficiencyStandardVersion: PROFICIENCY_STANDARD_VERSION, proficiencyEligible: true, proficiencyLevelId: "functional", netWpm: 44, completedAt: "2026-08-01T10:00:00.000Z" },
  ];
  const summary = getProficiencySummary(attempts);
  const performance = getPerformanceSummary(attempts);

  assert.equal(summary.count, 1);
  assert.equal(summary.bestLevel.id, "functional");
  assert.equal(performance.proficiency.bestLevel.id, "functional");
});

test("assessment presets and validity policy enforce comparable 1, 3, and 5 minute runs", () => {
  const durations = testPresets
    .filter((item) => item.assessment)
    .map((item) => item.durationSeconds)
    .sort((a, b) => a - b);
  const fiveMinute = testPresets.find((item) => item.id === "endurance-300");
  const policy = getBenchmarkPolicy(fiveMinute);

  assert.deepEqual(durations, [60, 180, 300]);
  assert.equal(policy.requireFullDuration, true);
  assert.equal(policy.allowPauses, false);
  assert.equal(policy.minimumCharacters, 100);
  assert.equal(getBenchmarkPolicy(testPresets.find((item) => item.id === "sprint-15")).personalBestEligible, false);
});

test("level evidence survives compact history and cloud metadata", () => {
  const attempt = {
    id: "assessment-1",
    type: "test",
    testId: "endurance-300",
    durationSeconds: 300,
    netWpm: 57,
    accuracy: 98,
    benchmarkValid: true,
    validSession: true,
    personalBestEligible: true,
    proficiencyStandardVersion: PROFICIENCY_STANDARD_VERSION,
    proficiencyAssessmentMode: "level",
    proficiencyEligible: true,
    proficiencyLevelId: "proficient",
    proficiencyLevelLabel: "Proficient",
    accuracyBandId: "reliable",
    paceBandId: "proficient",
  };
  const compact = compactAttemptSummary(attempt);
  const cloud = toSessionPayload(attempt);

  assert.equal(compact.proficiencyLevelId, "proficient");
  assert.equal(cloud.valid_benchmark, true);
  assert.equal(cloud.metadata.proficiencyLevelId, "proficient");
  assert.equal(cloud.metadata.proficiencyStandardVersion, PROFICIENCY_STANDARD_VERSION);
});
