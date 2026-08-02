import { clamp } from "./number.js";

export function calculateConsistency(samples = []) {
  const usable = samples.filter((value) => Number.isFinite(value) && value > 0);
  if (usable.length < 2) return usable.length === 1 ? 100 : 0;

  const mean = usable.reduce((sum, value) => sum + value, 0) / usable.length;
  if (!mean) return 0;

  const variance = usable.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / usable.length;
  const standardDeviation = Math.sqrt(variance);
  return Math.round(clamp(100 - ((standardDeviation / mean) * 100), 0, 100));
}

export function getKeyErrorRate(stat = {}) {
  const attempts = Number(stat.attempts) || 0;
  const errors = Number(stat.errors) || 0;
  if (!attempts) return 0;
  return (errors / attempts) * 100;
}

export function getWeakKeys(keyStats = {}, limit = 6) {
  return Object.entries(keyStats)
    .map(([key, stat]) => ({
      key,
      attempts: Number(stat.attempts) || 0,
      errors: Number(stat.errors) || 0,
      errorRate: getKeyErrorRate(stat),
    }))
    .filter((item) => item.attempts >= 8 && item.errors > 0)
    .sort((a, b) => {
      if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
      return b.errors - a.errors;
    })
    .slice(0, limit);
}

export function getStrongKeys(keyStats = {}, limit = 6) {
  return Object.entries(keyStats)
    .map(([key, stat]) => ({
      key,
      attempts: Number(stat.attempts) || 0,
      errors: Number(stat.errors) || 0,
      errorRate: getKeyErrorRate(stat),
    }))
    .filter((item) => item.attempts >= 20)
    .sort((a, b) => {
      if (a.errorRate !== b.errorRate) return a.errorRate - b.errorRate;
      return b.attempts - a.attempts;
    })
    .slice(0, limit);
}

export function getSkillLabel(wpm = 0, accuracy = 0) {
  if (accuracy < 85) return "Accuracy first";
  if (wpm < 15) return "Getting started";
  if (wpm < 30) return "Developing control";
  if (wpm < 45) return "Everyday typist";
  if (wpm < 60) return "Confident typist";
  if (wpm < 80) return "Advanced typist";
  return "High-speed typist";
}

export function buildMistakeSummary(target, typed) {
  const words = [];
  const keyCounts = {};
  let wordStart = 0;

  const flushWord = (end) => {
    const expectedWord = target.slice(wordStart, end);
    const typedWord = typed.slice(wordStart, end);
    if (expectedWord && expectedWord !== typedWord) {
      words.push({ expected: expectedWord, typed: typedWord || "(missed)" });
    }
    wordStart = end + 1;
  };

  const comparedLength = Math.min(target.length, typed.length);
  for (let index = 0; index < comparedLength; index += 1) {
    const expected = target[index];
    const actual = typed[index];
    if (expected !== actual) {
      const key = expected === " " ? "Space" : expected;
      keyCounts[key] = (keyCounts[key] || 0) + 1;
    }
    if (target[index] === " ") flushWord(index);
  }

  if (typed.length >= target.length) flushWord(target.length);

  return {
    words: words.slice(0, 8),
    keys: Object.entries(keyCounts)
      .map(([key, errors]) => ({ key, errors }))
      .sort((a, b) => b.errors - a.errors)
      .slice(0, 8),
  };
}
