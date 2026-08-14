import test from "node:test";
import assert from "node:assert/strict";
import { lessons } from "../data/curriculum.js";
import { generatePracticeSession } from "../data/contentBank.js";
import {
  buildPracticeRecipe,
  buildRecoveryConfig,
  normalisePracticeConfig,
} from "../lib/practiceRecipes.js";

function getLesson(id) {
  const lesson = lessons.find((item) => item.id === id);
  assert.ok(lesson, `missing lesson ${id}`);
  return lesson;
}

function assertInsideLessonBoundary(generated, lesson) {
  const disallowed = [...generated.text]
    .filter((character) => !lesson.allowedCharacters.includes(character));
  assert.deepEqual(
    [...new Set(disallowed)],
    [],
    `${lesson.id} generated locked characters: ${[...new Set(disallowed)].join("")}`,
  );
}

function generateRecovery(lesson, result, seed, allowedCharacters = lesson.allowedCharacters) {
  const config = buildRecoveryConfig(result, { category: "general" }, {
    sourceType: "lesson",
    sourceId: lesson.id,
    allowedCharacters,
  });
  const recipe = buildPracticeRecipe({ ...config, seed }, {});
  return {
    config,
    recipe,
    generated: generatePracticeSession(recipe, { recipe }),
  };
}

test("canonical lesson id cannot be widened by a caller-supplied recovery boundary", () => {
  const lesson = getLesson("top-r-u");
  const widenedBoundary = `${lesson.allowedCharacters}townpcvmbxyz`;
  const recovery = buildRecoveryConfig({
    difficultKeys: [{ key: "r" }, { key: "t" }],
    difficultBigrams: [{ key: "re" }, { key: "rt" }],
    mistakeWords: [{ expected: "read" }, { expected: "town" }],
    confusionMatrix: { r: { u: 2, t: 5 } },
  }, {}, {
    sourceType: "lesson",
    sourceId: lesson.id,
    allowedCharacters: widenedBoundary,
  });

  assert.equal(recovery.remediationAllowedCharacters, lesson.allowedCharacters);
  assert.deepEqual(recovery.focusKeys, ["r"]);
  assert.deepEqual(recovery.focusBigrams, ["re"]);
  assert.deepEqual(recovery.recoveryWords, ["read"]);
  assert.deepEqual(recovery.confusionPairs, [{ expected: "r", actual: "u", count: 2 }]);
});

test("a known source lesson restores its canonical boundary when old state omits it", () => {
  const lesson = getLesson("top-r-u");
  const normalised = normalisePracticeConfig({
    purpose: "recovery",
    remediationSourceType: "lesson",
    remediationSourceId: lesson.id,
    focusKeys: ["r", "t"],
    recoveryWords: ["read", "town"],
  });

  assert.equal(normalised.remediationAllowedCharacters, lesson.allowedCharacters);
  assert.deepEqual(normalised.focusKeys, ["r"]);
  assert.deepEqual(normalised.recoveryWords, ["read"]);
});

test("generator defense-in-depth clamps a raw widened recipe to the canonical source lesson", () => {
  const lesson = getLesson("top-r-u");
  const rawRecipe = {
    purpose: "recovery",
    contentType: "words",
    category: "general",
    goalType: "words",
    wordCount: 120,
    difficulty: "adaptive",
    targetDensity: 0.58,
    focusKeys: ["t"],
    focusBigrams: ["to"],
    recoveryWords: ["town"],
    confusionPairs: [],
    remediationSourceType: "lesson",
    remediationSourceId: lesson.id,
    remediationAllowedCharacters: `${lesson.allowedCharacters}townpcvmbxyz`,
    seed: 90210,
  };
  const generated = generatePracticeSession(rawRecipe, { recipe: rawRecipe });

  assertInsideLessonBoundary(generated, lesson);
  assert.ok(!generated.text.split(/\s+/).includes("town"));
});

test("every lesson survives hostile locked-key evidence across multiple recovery seeds", () => {
  const universe = "abcdefghijklmnopqrstuvwxyz0123456789;,./?' :-₹@_";

  for (const lesson of lessons) {
    const safeKey = [...lesson.allowedCharacters]
      .find((character) => character !== " " && character.length === 1);
    const lockedKey = [...universe]
      .find((character) => !lesson.allowedCharacters.includes(character));
    const safeWord = lesson.practiceTokens.find((token) => (
      /^[a-z'-]{2,30}$/i.test(String(token))
      && [...String(token).toLowerCase()]
        .every((character) => lesson.allowedCharacters.includes(character))
    ));

    for (const seed of [17, 701, 20260814]) {
      const result = {
        difficultKeys: [
          ...(safeKey ? [{ key: safeKey }] : []),
          ...(lockedKey ? [{ key: lockedKey }] : []),
        ],
        difficultBigrams: safeKey && lockedKey
          ? [{ key: `${safeKey}${lockedKey}` }]
          : [],
        mistakeWords: [
          ...(safeWord ? [{ expected: safeWord }] : []),
          ...(lockedKey ? [{ expected: `a${lockedKey}x` }] : []),
        ],
        confusionMatrix: safeKey && lockedKey
          ? { [safeKey]: { [lockedKey]: 4 } }
          : {},
      };
      const { config, generated } = generateRecovery(lesson, result, seed);

      assert.equal(config.remediationAllowedCharacters, lesson.allowedCharacters);
      assertInsideLessonBoundary(generated, lesson);
      assert.ok(generated.text.trim().length > 0, `${lesson.id} generated empty recovery text`);
    }
  }
});

test("R/U recovery keeps exact recovery words, target density, and spacing across fresh text", () => {
  const lesson = getLesson("top-r-u");
  const result = {
    difficultKeys: [{ key: "r" }, { key: "u" }, { key: "t" }],
    difficultBigrams: [{ key: "re" }, { key: "ui" }, { key: "rt" }],
    mistakeWords: [{ expected: "read" }, { expected: "guide" }, { expected: "town" }],
    confusionMatrix: { r: { u: 2, t: 5 } },
  };
  const first = generateRecovery(lesson, result, 401);
  const freshRecipe = buildPracticeRecipe({ ...first.config, seed: 402 }, {});
  const fresh = generatePracticeSession(freshRecipe, { recipe: freshRecipe });

  for (const generated of [first.generated, fresh]) {
    const words = generated.text.split(/\s+/);
    assertInsideLessonBoundary(generated, lesson);
    assert.ok(words.filter((word) => word === "read").length >= 2);
    assert.ok(words.filter((word) => word === "guide").length >= 2);
    assert.equal(generated.metadata.repeatRate, 0);
    assert.ok(Math.abs(generated.metadata.focusDensity - 0.58) < 0.001);
  }
  assert.notEqual(first.generated.metadata.fingerprint, fresh.metadata.fingerprint);
});

test("chained recovery cannot widen the original lesson boundary after new locked-key mistakes", () => {
  const lesson = getLesson("top-r-u");
  const first = generateRecovery(lesson, {
    difficultKeys: [{ key: "r" }],
    difficultBigrams: [{ key: "re" }],
    mistakeWords: [{ expected: "read" }],
    confusionMatrix: {},
  }, 501);
  const retryConfig = buildRecoveryConfig({
    difficultKeys: [{ key: "u" }, { key: "t" }, { key: "p" }],
    difficultBigrams: [{ key: "ui" }, { key: "ut" }, { key: "up" }],
    mistakeWords: [{ expected: "guide" }, { expected: "town" }, { expected: "report" }],
    confusionMatrix: { u: { t: 4, p: 3 } },
  }, {
    ...first.config,
    // Simulate stale/tampered state trying to widen the serialized boundary.
    remediationAllowedCharacters: `${lesson.allowedCharacters}topwn`,
  });
  const retryRecipe = buildPracticeRecipe({ ...retryConfig, seed: 502 }, {});
  const retry = generatePracticeSession(retryRecipe, { recipe: retryRecipe });

  assert.equal(retryConfig.remediationAllowedCharacters, lesson.allowedCharacters);
  assert.deepEqual(retryConfig.focusKeys, ["u"]);
  assert.deepEqual(retryConfig.focusBigrams, ["ui"]);
  assert.deepEqual(retryConfig.recoveryWords, ["guide"]);
  assertInsideLessonBoundary(retry, lesson);
});
