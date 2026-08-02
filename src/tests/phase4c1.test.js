import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPracticeRecipe,
  buildRecoveryConfig,
  getRecipeFocusPreview,
  normalisePracticeConfig,
} from "../lib/practiceRecipes.js";
import {
  generatePracticeSession,
  generatePracticeText,
} from "../data/contentBank.js";
import { getPracticeAccuracyTarget } from "../lib/sessionRules.js";
import { DATA_VERSION, validateImportedData } from "../lib/storage.js";

function learnerData(overrides = {}) {
  return {
    profile: { experience: "touch-typist", primaryGoal: "accuracy" },
    progress: {
      completedLessons: ["home-f-j", "home-d-k", "home-s-l", "home-a-semicolon", "home-g-h", "home-row"],
      averageWpm: 31,
      averageAccuracy: 93,
      ...overrides.progress,
    },
    statistics: {
      keyStats: {},
      bigramStats: {},
      wordStats: {},
      dailyActivity: {},
      practiceContentHistory: [],
      ...overrides.statistics,
    },
  };
}

function timingStat({ attempts, errors = 0, latency = 400, confusions = {} }) {
  return {
    attempts,
    correct: attempts - errors,
    errors,
    timedAttempts: attempts,
    totalLatencyMs: attempts * latency,
    fastestMs: latency - 50,
    slowestMs: latency + 80,
    confusions,
  };
}

test("adaptive recipes combine weak keys, bigrams, confusions, and recovery words", () => {
  const data = learnerData({
    statistics: {
      keyStats: {
        t: timingStat({ attempts: 30, errors: 8, latency: 680, confusions: { r: 5 } }),
        e: timingStat({ attempts: 40, errors: 1, latency: 310 }),
      },
      bigramStats: {
        th: timingStat({ attempts: 18, errors: 6, latency: 760 }),
        er: timingStat({ attempts: 25, errors: 1, latency: 340 }),
      },
      wordStats: {
        theory: { errors: 4, lastPractisedAt: "2026-08-01T08:00:00.000Z" },
      },
    },
  });
  const recipe = buildPracticeRecipe({ purpose: "adaptive", contentType: "words", seed: 7 }, data);
  assert.equal(recipe.purpose, "adaptive");
  assert.ok(recipe.focusKeys.includes("t"));
  assert.ok(recipe.focusBigrams.includes("th"));
  assert.deepEqual(recipe.confusionPairs[0], { expected: "t", actual: "r", count: 5, score: 5 });
  assert.ok(recipe.recoveryWords.includes("theory"));
  assert.equal(recipe.skillStage, "developing");
  assert.match(recipe.summary, /keys t/);
});

test("mistake recovery preserves exact session evidence", () => {
  const config = buildRecoveryConfig({
    difficultKeys: [{ key: "T" }, { key: "Space" }],
    difficultBigrams: [{ key: "th" }, { key: "he" }],
    mistakeWords: [{ expected: "theory" }, { expected: "their" }],
    confusionMatrix: { t: { r: 3 }, h: { j: 1 } },
  }, { category: "study" });
  assert.equal(config.purpose, "recovery");
  assert.equal(config.contentType, "words");
  assert.deepEqual(config.focusKeys, ["t"]);
  assert.deepEqual(config.focusBigrams, ["th", "he"]);
  assert.deepEqual(config.recoveryWords, ["theory", "their"]);
  assert.deepEqual(config.confusionPairs.map((item) => [item.expected, item.actual]), [["t", "r"], ["h", "j"]]);
  assert.equal(config.durationSeconds, 180);
});

test("recovery generation includes exact words and reaches useful focus density", () => {
  const recipe = buildPracticeRecipe({
    purpose: "recovery",
    contentType: "words",
    category: "study",
    goalType: "words",
    wordCount: 140,
    targetDensity: 0.55,
    focusKeys: ["t"],
    focusBigrams: ["th"],
    recoveryWords: ["theory", "their"],
    confusionPairs: [{ expected: "t", actual: "r", count: 4 }],
    seed: 44,
  }, learnerData());
  const generated = generatePracticeSession(recipe, { recipe });
  const words = generated.text.toLowerCase().split(/\s+/);
  assert.ok(words.includes("theory"));
  assert.ok(words.includes("their"));
  assert.ok(generated.metadata.focusDensity >= 0.5);
  assert.ok(generated.metadata.uniqueRatio >= 0.65);
  for (let index = 1; index < words.length; index += 1) {
    assert.notEqual(words[index], words[index - 1], "focused words should not be duplicated side by side");
  }
});

test("recent matching content is excluded when enough fresh words exist", () => {
  const firstRecipe = buildPracticeRecipe({
    purpose: "balanced",
    contentType: "words",
    category: "general",
    goalType: "words",
    wordCount: 100,
    seed: 101,
  }, learnerData());
  const first = generatePracticeSession(firstRecipe, { recipe: firstRecipe });
  const data = learnerData({
    statistics: {
      practiceContentHistory: [{
        fingerprint: first.metadata.fingerprint,
        contentType: "words",
        category: "general",
        items: first.metadata.items,
      }],
    },
  });
  const secondRecipe = buildPracticeRecipe({
    purpose: "balanced",
    contentType: "words",
    category: "general",
    goalType: "words",
    wordCount: 100,
    seed: 102,
  }, data);
  const second = generatePracticeSession(secondRecipe, { recipe: secondRecipe });
  const secondWords = new Set(second.text.toLowerCase().split(/\s+/));
  assert.notEqual(second.metadata.fingerprint, first.metadata.fingerprint);
  assert.equal(first.metadata.items.filter((item) => secondWords.has(item.toLowerCase())).length, 0);
});

test("five-minute sentence sessions provide fresh natural items without immediate repetition", () => {
  const recipe = buildPracticeRecipe({
    purpose: "endurance",
    contentType: "sentences",
    category: "work",
    goalType: "time",
    durationSeconds: 300,
    seed: 900,
  }, learnerData());
  const generated = generatePracticeSession(recipe, { recipe });
  assert.ok(generated.metadata.wordCount >= 600);
  assert.ok(generated.metadata.totalItems >= 45);
  assert.ok(generated.metadata.uniqueRatio >= 0.95);
  assert.match(generated.text, /\./);
  for (let index = 1; index < generated.metadata.items.length; index += 1) {
    assert.notEqual(generated.metadata.items[index], generated.metadata.items[index - 1]);
  }
});

test("the same recipe and seed are deterministic while a fresh seed changes content", () => {
  const config = { purpose: "balanced", contentType: "words", category: "technology", goalType: "words", wordCount: 80, seed: 73 };
  const recipeA = buildPracticeRecipe(config, learnerData());
  const recipeB = buildPracticeRecipe(config, learnerData());
  const a = generatePracticeSession(recipeA, { recipe: recipeA });
  const b = generatePracticeSession(recipeB, { recipe: recipeB });
  assert.equal(a.text, b.text);
  assert.equal(a.metadata.fingerprint, b.metadata.fingerprint);
  const recipeC = buildPracticeRecipe({ ...config, seed: 74 }, learnerData());
  const c = generatePracticeSession(recipeC, { recipe: recipeC });
  assert.notEqual(c.metadata.fingerprint, a.metadata.fingerprint);
});

test("legacy text generation remains compatible", () => {
  const text = generatePracticeText({ contentType: "smart", goalType: "words", wordCount: 50, seed: 5 }, { weakKeys: ["q"] });
  assert.ok(text.split(/\s+/).length >= 50);
  assert.match(text, /q/i);
});

test("purpose-based accuracy rules are centralised", () => {
  assert.equal(getPracticeAccuracyTarget({ purpose: "accuracy" }), 97);
  assert.equal(getPracticeAccuracyTarget({ purpose: "recovery" }), 96);
  assert.equal(getPracticeAccuracyTarget({ purpose: "adaptive" }), 95);
  assert.equal(getPracticeAccuracyTarget({ purpose: "speed" }), 92);
  assert.equal(getPracticeAccuracyTarget({ purpose: "endurance" }), 95);
  assert.equal(getPracticeAccuracyTarget({ purpose: "balanced", contentType: "numbers" }), 96);
  assert.equal(getPracticeAccuracyTarget({ purpose: "balanced", contentType: "custom" }), 95);
});

test("version 6 smart configuration migrates to a version 7 adaptive recipe", () => {
  const migrated = validateImportedData({
    version: 6,
    lastPracticeConfig: {
      contentType: "smart",
      goalType: "time",
      durationSeconds: 300,
    },
    statistics: {
      practiceContentHistory: [{ fingerprint: "abc", contentType: "words", category: "general", items: ["first"] }],
    },
  });
  assert.equal(migrated.version, DATA_VERSION);
  assert.equal(migrated.lastPracticeConfig.purpose, "adaptive");
  assert.equal(migrated.lastPracticeConfig.contentType, "words");
  assert.equal(migrated.statistics.practiceContentHistory.length, 1);
});

test("normalisation bounds unsafe recipe fields", () => {
  const config = normalisePracticeConfig({
    purpose: "unknown",
    contentType: "smart",
    durationSeconds: 0,
    wordCount: 1,
    targetDensity: 4,
    recoveryWords: ["valid", "x", "bad word", "valid"],
    focusBigrams: ["th", "toolong"],
  });
  assert.equal(config.purpose, "adaptive");
  assert.equal(config.contentType, "words");
  assert.equal(config.durationSeconds, 300);
  assert.equal(config.wordCount, 10);
  assert.equal(config.targetDensity, 0.75);
  assert.deepEqual(config.recoveryWords, ["valid"]);
  assert.deepEqual(config.focusBigrams, ["th"]);
});

test("adaptive preview exposes all supported evidence types", () => {
  const preview = getRecipeFocusPreview(learnerData({
    statistics: {
      keyStats: { t: timingStat({ attempts: 20, errors: 5, latency: 700, confusions: { r: 3 } }) },
      bigramStats: { th: timingStat({ attempts: 12, errors: 4, latency: 760 }) },
      wordStats: { theory: { errors: 3 } },
    },
  }));
  assert.equal(preview.keys[0].key, "t");
  assert.equal(preview.bigrams[0].key, "th");
  assert.equal(preview.confusions[0].actual, "r");
  assert.equal(preview.words[0].word, "theory");
});

test("word recipe target weighting does not accidentally make almost every filler word focused", () => {
  const recipe = buildPracticeRecipe({
    purpose: "adaptive",
    contentType: "words",
    category: "general",
    goalType: "words",
    wordCount: 300,
    targetDensity: 0.4,
    focusKeys: ["q"],
    seed: 314,
  }, learnerData());
  const generated = generatePracticeSession(recipe, { recipe });
  assert.ok(generated.metadata.focusDensity >= 0.34);
  assert.ok(generated.metadata.focusDensity <= 0.5);
});
