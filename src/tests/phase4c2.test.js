import test from "node:test";
import assert from "node:assert/strict";
import {
  analyseMotorPattern,
  createFrequencyIndex,
  resolveFeatureProgression,
  scoreMotorDifficulty,
} from "../lib/motorDifficulty.js";
import { commonWords } from "../data/wordBank.js";
import { generatePracticeSession } from "../data/contentBank.js";
import { buildPracticeRecipe, normalisePracticeConfig } from "../lib/practiceRecipes.js";

function learnerData(stage = "developing", history = []) {
  const stageMap = {
    foundation: { completedLessons: [], averageWpm: 12, averageAccuracy: 88 },
    developing: { completedLessons: Array.from({ length: 8 }, (_, index) => `lesson-${index}`), averageWpm: 28, averageAccuracy: 93 },
    functional: { completedLessons: Array.from({ length: 20 }, (_, index) => `lesson-${index}`), averageWpm: 42, averageAccuracy: 95 },
    advanced: { completedLessons: Array.from({ length: 26 }, (_, index) => `lesson-${index}`), averageWpm: 64, averageAccuracy: 97 },
  };
  return {
    progress: stageMap[stage],
    statistics: {
      keyStats: {},
      bigramStats: {},
      wordStats: {},
      practiceContentHistory: history,
    },
  };
}

function recipe(config, stage = "developing", history = []) {
  return buildPracticeRecipe(config, learnerData(stage, history));
}

test("motor metadata detects same-finger transitions, alternation, repeats, and uncommon pairs", () => {
  const sameFinger = analyseMotorPattern("fred");
  const alternating = analyseMotorPattern("take");
  const repeated = analyseMotorPattern("letter");
  const uncommon = analyseMotorPattern("quiz");
  assert.ok(sameFinger.sameFingerTransitions >= 1);
  assert.ok(alternating.alternationRatio > sameFinger.alternationRatio);
  assert.ok(repeated.repeatedLetters >= 1);
  assert.ok(uncommon.uncommonBigrams >= 1);
});

test("difficulty scoring includes frequency and motor movement rather than word length alone", () => {
  const frequencyIndex = createFrequencyIndex(commonWords);
  const easy = scoreMotorDifficulty("the and with", { frequencyIndex, totalWords: commonWords.length });
  const hard = scoreMotorDifficulty("quiz zigzag awkwardly", { frequencyIndex, totalWords: commonWords.length });
  assert.ok(hard.score > easy.score + 15);
  assert.ok(hard.averageFrequencyTier >= easy.averageFrequencyTier);
  assert.ok(hard.uncommonBigrams >= easy.uncommonBigrams);
});

test("easy and hard word recipes produce measurably different motor profiles", () => {
  const easyRecipe = recipe({ contentType: "words", category: "general", difficulty: "easy", goalType: "words", wordCount: 300, seed: 410 });
  const hardRecipe = recipe({ contentType: "words", category: "general", difficulty: "hard", goalType: "words", wordCount: 300, seed: 410 });
  const easy = generatePracticeSession(easyRecipe, { recipe: easyRecipe });
  const hard = generatePracticeSession(hardRecipe, { recipe: hardRecipe });
  assert.ok(hard.metadata.motor.averageScore > easy.metadata.motor.averageScore + 3);
  assert.ok(hard.metadata.motor.frequencyTiers[3] + hard.metadata.motor.frequencyTiers[4]
    > easy.metadata.motor.frequencyTiers[3] + easy.metadata.motor.frequencyTiers[4]);
});

test("adaptive difficulty follows the learner stage", () => {
  const foundationRecipe = recipe({ contentType: "words", difficulty: "adaptive", goalType: "words", wordCount: 220, seed: 21 }, "foundation");
  const advancedRecipe = recipe({ contentType: "words", difficulty: "adaptive", goalType: "words", wordCount: 220, seed: 21 }, "advanced");
  const foundation = generatePracticeSession(foundationRecipe, { recipe: foundationRecipe });
  const advanced = generatePracticeSession(advancedRecipe, { recipe: advancedRecipe });
  assert.equal(foundationRecipe.difficultyTarget.label, "foundation");
  assert.equal(advancedRecipe.difficultyTarget.label, "advanced");
  assert.ok(advanced.metadata.motor.averageScore > foundation.metadata.motor.averageScore);
});

test("progressive feature policy increases capitals, punctuation, and numbers by stage", () => {
  const foundation = resolveFeatureProgression({ progressiveFeatures: true, skillStage: "foundation", difficulty: "balanced" });
  const advanced = resolveFeatureProgression({ progressiveFeatures: true, skillStage: "advanced", difficulty: "hard" });
  assert.ok(advanced.punctuationRate > foundation.punctuationRate);
  assert.ok(advanced.capitalRate > foundation.capitalRate);
  assert.ok(advanced.numberRate > foundation.numberRate);
  assert.equal(advanced.symbols, true);
});

test("document content is supported and normalised safely", () => {
  const config = normalisePracticeConfig({ contentType: "documents", documentStyle: "government", progressiveFeatures: true });
  assert.equal(config.contentType, "documents");
  assert.equal(config.documentStyle, "government");
  assert.equal(config.progressiveFeatures, true);
});

test("real-world, office, study, and government presets generate meaningfully different documents", () => {
  const configs = [
    { contentType: "documents", category: "general", documentStyle: "everyday" },
    { contentType: "documents", category: "work", documentStyle: "email" },
    { contentType: "documents", category: "study", documentStyle: "study" },
    { contentType: "documents", category: "government", documentStyle: "government" },
  ];
  const outputs = configs.map((config, index) => {
    const built = recipe({ ...config, goalType: "words", wordCount: 160, seed: 700 + index }, "functional");
    return generatePracticeSession(built, { recipe: built });
  });
  assert.equal(new Set(outputs.map((item) => item.metadata.fingerprint)).size, configs.length);
  assert.match(outputs[0].text, /Meeting note|Notice|Data entry task/);
  assert.match(outputs[1].text, /To:|Weekly report|Meeting note/);
  assert.match(outputs[2].text, /revision|assessment|study|research/i);
  assert.match(outputs[3].text, /Application record|Notice|verification|candidate/i);
});

test("ten-minute natural sentence sessions avoid immediate and visible repetition", () => {
  const built = recipe({ contentType: "sentences", category: "work", difficulty: "balanced", goalType: "time", durationSeconds: 600, seed: 88 }, "functional");
  const generated = generatePracticeSession(built, { recipe: built });
  assert.ok(generated.metadata.wordCount >= 2050);
  assert.equal(generated.metadata.immediateRepeats, 0);
  assert.ok(generated.metadata.uniqueRatio >= 0.97);
  assert.ok(generated.metadata.totalItems >= 85);
});

test("twenty-minute document sessions have enough text for 180 WPM plus margin", () => {
  const built = recipe({ contentType: "documents", category: "government", documentStyle: "government", goalType: "time", durationSeconds: 1200, seed: 612 }, "advanced");
  const generated = generatePracticeSession(built, { recipe: built });
  assert.ok(generated.metadata.wordCount >= 4050);
  assert.ok(generated.metadata.uniqueRatio >= 0.95);
  assert.equal(generated.metadata.immediateRepeats, 0);
});

test("recent content history changes generated material and excludes previous document items", () => {
  const firstRecipe = recipe({ contentType: "documents", category: "work", documentStyle: "email", goalType: "words", wordCount: 180, seed: 1001 });
  const first = generatePracticeSession(firstRecipe, { recipe: firstRecipe });
  const history = [{
    fingerprint: first.metadata.fingerprint,
    contentType: "documents",
    category: "work",
    items: first.metadata.items,
  }];
  const secondRecipe = recipe({ contentType: "documents", category: "work", documentStyle: "email", goalType: "words", wordCount: 180, seed: 1001 }, "developing", history);
  const second = generatePracticeSession(secondRecipe, { recipe: secondRecipe });
  assert.notEqual(second.metadata.fingerprint, first.metadata.fingerprint);
  const secondText = second.text.toLowerCase();
  assert.equal(first.metadata.items.filter((item) => secondText.includes(item.toLowerCase())).length, 0);
});



test("short high-focus sentence sessions do not repeat one sentence back to back", () => {
  const built = recipe({
    contentType: "sentences",
    category: "study",
    purpose: "adaptive",
    difficulty: "easy",
    goalType: "words",
    wordCount: 25,
    targetDensity: 0.58,
    focusKeys: ["g", "h", "j", ";"],
    focusBigrams: ["gh", "hj"],
    recoveryWords: ["through", "government"],
    seed: 100011,
  }, "foundation");
  const generated = generatePracticeSession(built, { recipe: built });
  assert.equal(generated.metadata.immediateRepeats, 0);
  assert.ok(generated.metadata.totalItems >= 8);
});

test("number sessions satisfy the selected word-count target", () => {
  const built = recipe({ contentType: "numbers", goalType: "words", wordCount: 200, seed: 404 });
  const generated = generatePracticeSession(built, { recipe: built });
  assert.ok(generated.metadata.wordCount >= 200);
});

test("generation metadata reports motor difficulty, feature counts, and repetition quality", () => {
  const built = recipe({ contentType: "words", difficulty: "hard", goalType: "words", wordCount: 160, progressiveFeatures: true, seed: 58 }, "advanced");
  const generated = generatePracticeSession(built, { recipe: built });
  assert.ok(generated.metadata.motor.averageScore > 0);
  assert.ok(["easy", "balanced", "challenging", "advanced"].includes(generated.metadata.motor.band));
  assert.ok(generated.metadata.featureCounts.punctuation > 0);
  assert.ok(generated.metadata.featureCounts.capitals > 0);
  assert.ok(generated.metadata.featureCounts.numbers > 0);
  assert.equal(generated.metadata.repeatRate, 0);
});
