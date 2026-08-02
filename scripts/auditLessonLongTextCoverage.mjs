import { lessons } from "../src/data/curriculum.js";
import { generatePracticeSession } from "../src/data/contentBank.js";

const WORD_COUNTS = [100, 200, 300, 500];
const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);

function percentile(values, ratio) {
  if (!values.length) return 0;
  const ordered = [...values].sort((first, second) => first - second);
  return ordered[Math.floor((ordered.length - 1) * ratio)];
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function exposureBand(coverageMultiple) {
  if (coverageMultiple < 1) return "below-floor";
  if (coverageMultiple < 1.25) return "thin";
  if (coverageMultiple < 2) return "adequate";
  return "strong";
}

const targetSamples = new Map();
const balanceSamples = new Map();
let invalidSessions = 0;

for (const lesson of lessons) {
  for (const wordCount of WORD_COUNTS) {
    for (const seed of SEEDS) {
      const generated = generatePracticeSession({
        contentType: "lesson",
        lessonId: lesson.id,
        goalType: "words",
        wordCount,
        seed,
      });
      const quality = generated.metadata.lessonCoverage;
      if (!quality.valid) invalidSessions += 1;

      for (const coverage of quality.coverage) {
        const key = `${lesson.id}\u0000${coverage.target}`;
        const samples = targetSamples.get(key) ?? [];
        samples.push({
          wordCount,
          actualWords: generated.metadata.wordCount,
          actual: coverage.actual,
          minimum: coverage.minimum,
        });
        targetSamples.set(key, samples);
      }

      if (quality.balance.required) {
        const samples = balanceSamples.get(lesson.id) ?? [];
        samples.push(quality.balance.ratio);
        balanceSamples.set(lesson.id, samples);
      }
    }
  }
}

const rows = [];
for (const lesson of lessons) {
  const targets = (lesson.coverageTargets ?? lesson.focusKeys).map(String).filter((target) => target !== "Space");
  for (const target of targets) {
    const samples = targetSamples.get(`${lesson.id}\u0000${target}`) ?? [];
    const rates = samples.map((sample) => (sample.actual / sample.actualWords) * 100);
    const ratiosToMinimum = samples.map((sample) => sample.actual / Math.max(1, sample.minimum));
    const meanCoverageMultiple = ratiosToMinimum.reduce((total, value) => total + value, 0) / ratiosToMinimum.length;
    rows.push({
      lesson: lesson.number,
      lessonId: lesson.id,
      title: lesson.title,
      target,
      samples: samples.length,
      minPer100Words: round(Math.min(...rates)),
      p10Per100Words: round(percentile(rates, 0.1)),
      medianPer100Words: round(percentile(rates, 0.5)),
      meanPer100Words: round(rates.reduce((total, value) => total + value, 0) / rates.length),
      maxPer100Words: round(Math.max(...rates)),
      meanCoverageMultiple: round(meanCoverageMultiple, 2),
      band: exposureBand(meanCoverageMultiple),
    });
  }
}

const balanceRows = lessons.flatMap((lesson) => {
  const samples = balanceSamples.get(lesson.id) ?? [];
  if (!samples.length) return [];
  return [{
    lesson: lesson.number,
    lessonId: lesson.id,
    title: lesson.title,
    samples: samples.length,
    minimumRatio: round(Math.min(...samples), 2),
    p10Ratio: round(percentile(samples, 0.1), 2),
    medianRatio: round(percentile(samples, 0.5), 2),
    meanRatio: round(samples.reduce((total, value) => total + value, 0) / samples.length, 2),
  }];
});

const ordered = [...rows].sort((first, second) => (
  first.meanPer100Words - second.meanPer100Words
  || first.lesson - second.lesson
  || first.target.localeCompare(second.target)
));

const summary = {
  generatedSessions: lessons.length * WORD_COUNTS.length * SEEDS.length,
  lessonCount: lessons.length,
  wordCounts: WORD_COUNTS,
  seedsPerMode: SEEDS.length,
  targetCount: rows.length,
  invalidSessions,
  bandCounts: Object.fromEntries(["below-floor", "thin", "adequate", "strong"].map((band) => [
    band,
    rows.filter((row) => row.band === band).length,
  ])),
};

const report = { summary, balanceRows, rows: ordered };
const output = process.argv.includes("--summary")
  ? { summary, balanceRows, weakestTargets: ordered.slice(0, 12) }
  : report;

console.log(JSON.stringify(output, null, 2));
