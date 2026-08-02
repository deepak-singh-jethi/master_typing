import { getProficiencySummary } from "./proficiency.js";
import { getRemediationSummary } from "./remediation.js";

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values = []) {
  const usable = values.map(Number).filter(Number.isFinite);
  if (!usable.length) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

export function isAttemptValid(attempt = {}) {
  return attempt.validSession !== false && attempt.benchmarkValid !== false;
}

export function isValidBenchmarkAttempt(attempt = {}, testId = null) {
  if (attempt.type !== "test") return false;
  if (testId && attempt.testId !== testId) return false;
  return attempt.benchmarkValid === true
    && attempt.personalBestEligible === true
    && attempt.validSession !== false;
}

export function getAttemptFamily(attempt = {}) {
  if (attempt.type === "diagnostic") return "diagnostic";
  if (attempt.type === "test") return "benchmark";
  if (attempt.type === "lesson") return "lesson";
  if (attempt.contentType === "numbers") return "numbers";
  if (["sentences", "paragraphs", "custom"].includes(attempt.contentType)) return "practical";
  if (["practice", "lesson-practice"].includes(attempt.type)) return "practice";
  return "other";
}

export function summarizeAttempts(attempts = [], predicate = () => true) {
  const filtered = attempts.filter((attempt) => predicate(attempt) && isAttemptValid(attempt));
  return {
    count: filtered.length,
    bestWpm: filtered.length ? Math.max(...filtered.map((item) => asNumber(item.netWpm))) : 0,
    averageWpm: average(filtered.map((item) => asNumber(item.netWpm))),
    averageAccuracy: average(filtered.map((item) => asNumber(item.keystrokeAccuracy, item.accuracy))),
    averageConsistency: average(filtered.map((item) => asNumber(item.consistency))),
    totalSeconds: filtered.reduce((sum, item) => sum + Math.max(0, asNumber(item.durationSeconds)), 0),
  };
}

export function getPerformanceSummary(attempts = []) {
  const standardBenchmarks = attempts.filter((attempt) => isValidBenchmarkAttempt(attempt, "standard-60"));
  const allBenchmarks = attempts.filter((attempt) => isValidBenchmarkAttempt(attempt));
  const lessons = summarizeAttempts(attempts, (attempt) => attempt.type === "lesson" && attempt.practiceMode === "guided");
  const practice = summarizeAttempts(attempts, (attempt) => (
    attempt.type === "practice" && getAttemptFamily(attempt) === "practice"
  ));
  const practical = summarizeAttempts(attempts, (attempt) => getAttemptFamily(attempt) === "practical");
  const numbers = summarizeAttempts(attempts, (attempt) => getAttemptFamily(attempt) === "numbers");

  return {
    proficiency: getProficiencySummary(attempts),
    remediation: getRemediationSummary(attempts),
    standardBenchmark: summarizeAttempts(standardBenchmarks),
    allBenchmarks: summarizeAttempts(allBenchmarks),
    lessons,
    practice,
    practical,
    numbers,
    standardBenchmarkAttempts: standardBenchmarks,
  };
}

export function getBenchmarkStatus(attempt = {}) {
  if (attempt.type !== "test" && attempt.type !== "diagnostic") return null;
  const explicitlyValid = attempt.type === "diagnostic"
    ? attempt.benchmarkValid === true && attempt.validSession !== false
    : isValidBenchmarkAttempt(attempt);
  if (!explicitlyValid) {
    return {
      valid: false,
      label: "Practice result only",
      reasons: attempt.validationReasons ?? attempt.invalidReasons ?? [],
    };
  }
  return {
    valid: true,
    label: attempt.type === "diagnostic"
      ? "Valid diagnostic"
      : attempt.proficiencyEligible && attempt.proficiencyLevelLabel
        ? `${attempt.proficiencyLevelLabel} level`
        : attempt.proficiencyAssessmentMode === "estimate"
          ? "Valid progress check"
          : "Valid benchmark",
    reasons: [],
  };
}
