import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toSessionPayload } from "../lib/cloudSync.js";
import { compactAttemptSummary } from "../lib/historyStore.js";
import { getPerformanceSummary } from "../lib/performance.js";
import {
  REMEDIATION_VERSION,
  buildRecoveryConfig,
  normalisePracticeConfig,
} from "../lib/practiceRecipes.js";
import { getRemediationSummary } from "../lib/remediation.js";

const mistakeResult = {
  difficultKeys: [{ key: "f" }, { key: "g" }],
  difficultBigrams: [{ key: "fr" }],
  mistakeWords: [{ expected: "fresh" }, { expected: "figure" }],
  confusionMatrix: { f: { g: 3 } },
};

test("recovery preserves the original practice recipe for a fresh transfer check", () => {
  const recovery = buildRecoveryConfig(mistakeResult, {
    presetId: "accuracy",
    purpose: "accuracy",
    contentType: "sentences",
    category: "work",
    goalType: "time",
    durationSeconds: 120,
    difficulty: "balanced",
    punctuation: true,
    capitals: true,
  }, {
    chainId: "chain-practice-1",
    sourceType: "practice",
    sourceId: "source-fingerprint",
  });

  assert.equal(recovery.purpose, "recovery");
  assert.equal(recovery.remediationVersion, REMEDIATION_VERSION);
  assert.equal(recovery.remediationChainId, "chain-practice-1");
  assert.equal(recovery.remediationStage, "recovery");
  assert.equal(recovery.remediationReturn.kind, "practice");
  assert.equal(recovery.remediationReturn.config.purpose, "accuracy");
  assert.equal(recovery.remediationReturn.config.contentType, "sentences");
  assert.equal(recovery.remediationReturn.config.durationSeconds, 120);
  assert.deepEqual(recovery.focusKeys, ["f", "g"]);
  assert.deepEqual(recovery.focusBigrams, ["fr"]);
});

test("test recovery returns to the exact assessment route without accepting unsafe routes", () => {
  const recovery = buildRecoveryConfig(mistakeResult, { category: "general" }, {
    chainId: "chain-test-1",
    sourceType: "test",
    sourceId: "endurance-300",
    returnTarget: { kind: "test", to: "/tests/endurance-300", label: "5-minute proficiency assessment" },
  });
  const unsafe = normalisePracticeConfig({
    ...recovery,
    remediationReturn: { kind: "test", to: "https://unsafe.example", label: "Unsafe" },
  });

  assert.deepEqual(recovery.remediationReturn, {
    kind: "test",
    to: "/tests/endurance-300",
    label: "5-minute proficiency assessment",
  });
  assert.equal(unsafe.remediationReturn, null);
});

test("failed recovery retries keep the original chain and reassessment target", () => {
  const first = buildRecoveryConfig(mistakeResult, { purpose: "balanced", contentType: "words" }, {
    chainId: "chain-retry-1",
    sourceType: "test",
    sourceId: "standard-60",
    returnTarget: { kind: "test", to: "/tests/standard-60", label: "1-minute progress check" },
  });
  const retry = buildRecoveryConfig(mistakeResult, first);

  assert.equal(retry.remediationChainId, "chain-retry-1");
  assert.equal(retry.remediationSourceType, "test");
  assert.equal(retry.remediationSourceId, "standard-60");
  assert.equal(retry.remediationReturn.to, "/tests/standard-60");
});

test("lesson recovery restores the same exercise mode before reassessment", () => {
  const recovery = buildRecoveryConfig(mistakeResult, { category: "general" }, {
    chainId: "chain-lesson-1",
    sourceType: "lesson",
    sourceId: "home-f-j",
    returnTarget: {
      kind: "lesson",
      to: "/learn/home-f-j",
      label: "F and J",
      session: { practiceMode: "timed", exerciseIndex: 2, wordCount: 200, durationSeconds: 300 },
    },
  });

  assert.equal(recovery.remediationReturn.kind, "lesson");
  assert.equal(recovery.remediationReturn.to, "/learn/home-f-j");
  assert.deepEqual(recovery.remediationReturn.session, {
    practiceMode: "timed",
    exerciseIndex: 2,
    wordCount: 200,
    durationSeconds: 300,
  });
});

test("remediation reporting requires recovery and a separate fresh reassessment", () => {
  const attempts = [
    { remediationVersion: REMEDIATION_VERSION, remediationChainId: "a", remediationStage: "recovery", sessionPassed: true, validSession: true, completedAt: "2026-08-01T10:00:00.000Z" },
    { remediationVersion: REMEDIATION_VERSION, remediationChainId: "a", remediationStage: "reassessment", sessionPassed: true, validSession: true, completedAt: "2026-08-01T10:05:00.000Z" },
    { remediationVersion: REMEDIATION_VERSION, remediationChainId: "b", remediationStage: "recovery", sessionPassed: true, validSession: true, completedAt: "2026-08-01T11:00:00.000Z" },
    { remediationVersion: REMEDIATION_VERSION, remediationChainId: "c", remediationStage: "recovery", sessionPassed: false, validSession: true, completedAt: "2026-08-01T12:00:00.000Z" },
    { remediationVersion: REMEDIATION_VERSION, remediationChainId: "c", remediationStage: "reassessment", sessionPassed: false, validSession: true, completedAt: "2026-08-01T12:05:00.000Z" },
  ];
  const summary = getRemediationSummary(attempts);

  assert.equal(summary.chainCount, 3);
  assert.equal(summary.recoveryPassed, 2);
  assert.equal(summary.transferChecked, 2);
  assert.equal(summary.transferPassed, 1);
  assert.equal(summary.pendingTransfer, 1);
  assert.equal(summary.transferRate, 50);
});

test("a reassessment cannot verify transfer before recovery has passed", () => {
  const summary = getRemediationSummary([
    { remediationVersion: REMEDIATION_VERSION, remediationChainId: "ordered", remediationStage: "reassessment", sessionPassed: true, validSession: true, completedAt: "2026-08-01T09:00:00.000Z" },
    { remediationVersion: REMEDIATION_VERSION, remediationChainId: "ordered", remediationStage: "recovery", sessionPassed: true, validSession: true, completedAt: "2026-08-01T09:05:00.000Z" },
  ]);

  assert.equal(summary.recoveryPassed, 1);
  assert.equal(summary.transferChecked, 0);
  assert.equal(summary.transferPassed, 0);
  assert.equal(summary.pendingTransfer, 1);
});

test("retyping saved custom material is not misreported as fresh transfer", () => {
  const summary = getRemediationSummary([
    { remediationVersion: REMEDIATION_VERSION, remediationChainId: "custom", remediationStage: "recovery", sessionPassed: true, validSession: true, completedAt: "2026-08-01T09:00:00.000Z" },
    { remediationVersion: REMEDIATION_VERSION, remediationChainId: "custom", remediationStage: "reassessment", remediationFreshText: false, sessionPassed: true, validSession: true, completedAt: "2026-08-01T09:05:00.000Z" },
  ]);

  assert.equal(summary.transferChecked, 0);
  assert.equal(summary.transferPassed, 0);
});

test("Phase 3 remediation evidence remains compatible with Phase 4 proficiency", () => {
  const attempt = {
    id: "assessment-transfer-1",
    type: "test",
    testId: "endurance-300",
    durationSeconds: 300,
    netWpm: 58,
    accuracy: 98,
    benchmarkValid: true,
    personalBestEligible: true,
    validSession: true,
    sessionPassed: true,
    proficiencyStandardVersion: 1,
    proficiencyEligible: true,
    proficiencyLevelId: "proficient",
    proficiencyLevelLabel: "Proficient",
    remediationVersion: REMEDIATION_VERSION,
    remediationChainId: "compatible-chain",
    remediationStage: "reassessment",
    remediationSourceType: "test",
    remediationSourceId: "endurance-300",
    completedAt: "2026-08-01T14:05:00.000Z",
  };
  const summary = getPerformanceSummary([
    { ...attempt, id: "recovery", type: "practice", proficiencyEligible: false, proficiencyLevelId: null, remediationStage: "recovery", completedAt: "2026-08-01T14:00:00.000Z" },
    attempt,
  ]);
  const compact = compactAttemptSummary(attempt);
  const cloud = toSessionPayload(attempt);

  assert.equal(summary.proficiency.bestLevel.id, "proficient");
  assert.equal(summary.remediation.transferPassed, 1);
  assert.equal(compact.remediationChainId, "compatible-chain");
  assert.equal(cloud.metadata.remediationStage, "reassessment");
});

test("successful recovery exposes an explicit fresh-transfer action", () => {
  const source = readFileSync(new URL("../pages/PracticeSessionPage.jsx", import.meta.url), "utf8");
  assert.match(source, /"Check transfer on fresh text"/);
  assert.match(source, /"Recheck original text"/);
  assert.match(source, /remediationStage: "reassessment"/);
  assert.match(source, /\["test", "lesson"\]\.includes\(target\?\.kind\)/);
  assert.match(source, /target\?\.kind === "practice"/);
});
