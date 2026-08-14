import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toSessionPayload } from "../lib/cloudSync.js";
import { compactAttemptSummary } from "../lib/historyStore.js";
import { getPerformanceSummary } from "../lib/performance.js";
import {
  REMEDIATION_VERSION,
  buildPracticeRecipe,
  buildRecoveryConfig,
  normalisePracticeConfig,
} from "../lib/practiceRecipes.js";
import { getRemediationSummary } from "../lib/remediation.js";
import { generatePracticeSession } from "../data/contentBank.js";
import { lessons } from "../data/curriculum.js";

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
  const allowedCharacters = "fj ";
  const recovery = buildRecoveryConfig(mistakeResult, { category: "general" }, {
    chainId: "chain-lesson-1",
    sourceType: "lesson",
    sourceId: "home-f-j",
    allowedCharacters,
    returnTarget: {
      kind: "lesson",
      to: "/learn/home-f-j",
      label: "F and J",
      session: { practiceMode: "timed", exerciseIndex: 2, wordCount: 200, durationSeconds: 300 },
    },
  });

  assert.equal(recovery.remediationReturn.kind, "lesson");
  assert.equal(recovery.remediationReturn.to, "/learn/home-f-j");
  assert.equal(recovery.remediationAllowedCharacters, allowedCharacters);
  assert.deepEqual(recovery.remediationReturn.session, {
    practiceMode: "timed",
    exerciseIndex: 2,
    wordCount: 200,
    durationSeconds: 300,
  });
});

test("lesson recovery keeps its curriculum boundary across fresh text and chained recovery", () => {
  const allowedCharacters = "asdfghjkl;eiru ";
  const first = buildRecoveryConfig(mistakeResult, { category: "general" }, {
    chainId: "chain-lesson-boundary",
    sourceType: "lesson",
    sourceId: "top-r-u",
    allowedCharacters,
    returnTarget: {
      kind: "lesson",
      to: "/learn/top-r-u",
      label: "R and U",
      session: { practiceMode: "guided", exerciseIndex: 1, wordCount: 100, durationSeconds: 180 },
    },
  });
  const freshText = normalisePracticeConfig({ ...first, seed: 12345 });
  const retry = buildRecoveryConfig(mistakeResult, first);

  assert.equal(first.remediationAllowedCharacters, allowedCharacters);
  assert.equal(freshText.remediationAllowedCharacters, allowedCharacters);
  assert.equal(retry.remediationAllowedCharacters, allowedCharacters);
  assert.equal(retry.remediationSourceType, "lesson");
  assert.equal(retry.remediationSourceId, "top-r-u");
});

test("lesson recovery entry point passes the lesson allowed-character boundary", () => {
  const source = readFileSync(new URL("../pages/LessonPage.jsx", import.meta.url), "utf8");
  assert.match(source, /allowedCharacters:\s*lesson\.allowedCharacters/);
});

test("lesson recovery sanitises mistake evidence to the source lesson boundary", () => {
  const allowedCharacters = "asdfghjkl;eiru ";
  const recovery = buildRecoveryConfig({
    difficultKeys: [{ key: "r" }, { key: "u" }, { key: "t" }, { key: "p" }],
    difficultBigrams: [{ key: "re" }, { key: "ui" }, { key: "rt" }, { key: "th" }],
    mistakeWords: [
      { expected: "read" },
      { expected: "guide" },
      { expected: "report" },
      { expected: "town" },
    ],
    confusionMatrix: {
      r: { t: 5, u: 2 },
      t: { r: 4 },
    },
  }, { category: "general" }, {
    sourceType: "lesson",
    sourceId: "top-r-u",
    allowedCharacters,
  });

  assert.deepEqual(recovery.focusKeys, ["r", "u"]);
  assert.deepEqual(recovery.focusBigrams, ["re", "ui"]);
  assert.deepEqual(recovery.recoveryWords, ["read", "guide"]);
  assert.deepEqual(recovery.confusionPairs, [{ expected: "r", actual: "u", count: 2 }]);
});

test("a locked accidental key is kept out of training while its learned expected key stays recoverable", () => {
  const recovery = buildRecoveryConfig({
    difficultKeys: [],
    difficultBigrams: [],
    mistakeWords: [],
    confusionMatrix: { r: { t: 6 } },
  }, { category: "general" }, {
    sourceType: "lesson",
    sourceId: "top-r-u",
    allowedCharacters: "asdfghjkl;eiru ",
  });

  assert.deepEqual(recovery.focusKeys, ["r"]);
  assert.deepEqual(recovery.confusionPairs, []);
});

test("normalisation cannot reintroduce locked recovery targets into a lesson chain", () => {
  const config = normalisePracticeConfig({
    purpose: "recovery",
    remediationSourceType: "lesson",
    remediationAllowedCharacters: "asdfghjkl;eiru ",
    focusKeys: ["r", "t", "p"],
    focusBigrams: ["re", "rt", "th"],
    recoveryWords: ["read", "report", "town"],
    confusionPairs: [
      { expected: "r", actual: "t", count: 5 },
      { expected: "r", actual: "u", count: 2 },
      { expected: "t", actual: "r", count: 3 },
    ],
  });

  assert.deepEqual(config.focusKeys, ["r"]);
  assert.deepEqual(config.focusBigrams, ["re"]);
  assert.deepEqual(config.recoveryWords, ["read"]);
  assert.deepEqual(config.confusionPairs, [{ expected: "r", actual: "u", count: 2 }]);
});

test("lesson recovery adaptive fallback ignores global evidence from locked keys", () => {
  const recipe = buildPracticeRecipe({
    purpose: "recovery",
    contentType: "words",
    remediationSourceType: "lesson",
    remediationAllowedCharacters: "asdfghjkl;eiru ",
  }, {
    statistics: {
      keyStats: {
        p: { attempts: 40, errors: 12, confusions: {} },
        r: { attempts: 30, errors: 6, confusions: { t: 6, u: 3 } },
        t: { attempts: 35, errors: 8, confusions: { r: 2 } },
      },
      bigramStats: {
        th: { attempts: 20, errors: 8 },
        re: { attempts: 20, errors: 5 },
      },
      wordStats: {
        report: { errors: 9 },
        read: { errors: 5 },
      },
    },
  });

  assert.ok(recipe.focusKeys.includes("r"));
  assert.ok(!recipe.focusKeys.includes("p"));
  assert.ok(!recipe.focusKeys.includes("t"));
  assert.deepEqual(recipe.focusBigrams, ["re"]);
  assert.deepEqual(recipe.recoveryWords, ["read"]);
  assert.deepEqual(recipe.confusionPairs, [{ expected: "r", actual: "u", count: 3, score: 3 }]);
  assert.ok(recipe.evidence.weakKeys.every((item) => "asdfghjkl;eiru ".includes(item.key)));
  assert.ok(recipe.evidence.weakBigrams.every((item) => [...item.key].every((key) => "asdfghjkl;eiru ".includes(key))));
  assert.ok(recipe.evidence.recoveryWords.every((item) => [...item.word].every((key) => "asdfghjkl;eiru ".includes(key))));
});

test("non-lesson recovery keeps unrestricted mistake evidence", () => {
  const recovery = buildRecoveryConfig({
    difficultKeys: [{ key: "r" }, { key: "t" }],
    difficultBigrams: [{ key: "rt" }],
    mistakeWords: [{ expected: "report" }],
    confusionMatrix: { r: { t: 4 } },
  }, { category: "general" }, {
    sourceType: "practice",
    sourceId: "free-practice",
    allowedCharacters: "asdfghjkl;eiru ",
  });

  assert.equal(recovery.remediationAllowedCharacters, null);
  assert.deepEqual(recovery.focusKeys, ["r", "t"]);
  assert.deepEqual(recovery.focusBigrams, ["rt"]);
  assert.deepEqual(recovery.recoveryWords, ["report"]);
  assert.deepEqual(recovery.confusionPairs, [{ expected: "r", actual: "t", count: 4 }]);
});


function generateLessonRecovery(lesson, result, seed = 20260814) {
  const recovery = buildRecoveryConfig(result, { category: "general" }, {
    sourceType: "lesson",
    sourceId: lesson.id,
    allowedCharacters: lesson.allowedCharacters,
  });
  const recipe = buildPracticeRecipe({ ...recovery, seed }, {});
  return {
    recovery,
    recipe,
    generated: generatePracticeSession(recipe, { recipe }),
  };
}

test("R/U mistake recovery generates only keys learned by the source lesson", () => {
  const lesson = lessons.find((item) => item.id === "top-r-u");
  const { generated } = generateLessonRecovery(lesson, {
    difficultKeys: [{ key: "r" }, { key: "u" }, { key: "t" }],
    difficultBigrams: [{ key: "re" }, { key: "ui" }, { key: "rt" }],
    mistakeWords: [{ expected: "read" }, { expected: "guide" }, { expected: "town" }],
    confusionMatrix: { r: { t: 4, u: 2 } },
  });

  assert.ok(generated.text.length > 0);
  assert.ok([...generated.text].every((character) => lesson.allowedCharacters.includes(character)));
  assert.ok(generated.text.split(/\s+/).includes("read"));
  assert.ok(generated.text.split(/\s+/).includes("guide"));
  assert.doesNotMatch(generated.text, /\b(?:town|monitor|session|configuration|report)\b/);
});

test("lesson recovery has a safe fallback even before real-word vocabulary exists", () => {
  const lesson = lessons.find((item) => item.id === "home-f-j");
  const { generated } = generateLessonRecovery(lesson, {
    difficultKeys: [{ key: "f" }],
    difficultBigrams: [{ key: "fj" }],
    mistakeWords: [],
    confusionMatrix: { f: { j: 2 } },
  }, 71);

  assert.ok(generated.text.length > 0);
  assert.ok([...generated.text].every((character) => lesson.allowedCharacters.includes(character)));
  assert.doesNotMatch(generated.text, /practice/i);
});

test("every curriculum lesson keeps generated recovery text inside its source keyboard boundary", () => {
  for (const lesson of lessons) {
    const literalFocus = lesson.focusKeys
      .map((key) => key === "Space" ? " " : String(key))
      .find((key) => key.length === 1 && key !== " ")
      ?? [...lesson.allowedCharacters].find((key) => key !== " ");
    const safeToken = lesson.practiceTokens.find((token) => (
      String(token).length >= 2
      && /^[a-z'-]+$/i.test(String(token))
      && [...String(token).toLowerCase()].every((character) => lesson.allowedCharacters.includes(character))
    ));
    const { generated } = generateLessonRecovery(lesson, {
      difficultKeys: literalFocus ? [{ key: literalFocus }] : [],
      difficultBigrams: [],
      mistakeWords: safeToken ? [{ expected: safeToken }] : [],
      confusionMatrix: {},
    }, 1000 + lesson.number);

    const disallowed = [...generated.text].filter((character) => !lesson.allowedCharacters.includes(character));
    assert.deepEqual(disallowed, [], `${lesson.id} generated locked characters: ${[...new Set(disallowed)].join("")}`);
  }
});

test("fresh text and chained lesson recovery remain curriculum-safe at generation time", () => {
  const lesson = lessons.find((item) => item.id === "top-r-u");
  const first = generateLessonRecovery(lesson, {
    difficultKeys: [{ key: "r" }],
    difficultBigrams: [{ key: "re" }],
    mistakeWords: [{ expected: "read" }],
    confusionMatrix: { r: { u: 2, t: 4 } },
  }, 201);
  const freshRecipe = buildPracticeRecipe({ ...first.recovery, seed: 202 }, {});
  const fresh = generatePracticeSession(freshRecipe, { recipe: freshRecipe });
  const retryConfig = buildRecoveryConfig({
    difficultKeys: [{ key: "u" }, { key: "t" }],
    difficultBigrams: [{ key: "ui" }, { key: "ut" }],
    mistakeWords: [{ expected: "guide" }, { expected: "town" }],
    confusionMatrix: { u: { t: 3 } },
  }, first.recovery);
  const retryRecipe = buildPracticeRecipe({ ...retryConfig, seed: 203 }, {});
  const retry = generatePracticeSession(retryRecipe, { recipe: retryRecipe });

  for (const generated of [first.generated, fresh, retry]) {
    assert.ok([...generated.text].every((character) => lesson.allowedCharacters.includes(character)));
  }
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
  assert.match(source, /\["test", "lesson", "review"\]\.includes\(target\?\.kind\)/);
  assert.match(source, /target\?\.kind === "practice"/);
});
