import { buildMistakeSummary, calculateConsistency } from "./metrics.js";
import { clamp } from "./number.js";

const MIN_TIMING_MS = 20;
const MAX_TIMING_MS = 5000;
const BURST_WINDOW_MS = 5000;

function createTimingStat() {
  return {
    attempts: 0,
    correct: 0,
    errors: 0,
    timedAttempts: 0,
    totalLatencyMs: 0,
    fastestMs: null,
    slowestMs: null,
    confusions: {},
  };
}

function cloneTimingStat(stat = {}) {
  return {
    attempts: Number(stat.attempts) || 0,
    correct: Number(stat.correct) || 0,
    errors: Number(stat.errors) || 0,
    timedAttempts: Number(stat.timedAttempts) || 0,
    totalLatencyMs: Number(stat.totalLatencyMs) || 0,
    fastestMs: Number.isFinite(Number(stat.fastestMs)) ? Number(stat.fastestMs) : null,
    slowestMs: Number.isFinite(Number(stat.slowestMs)) ? Number(stat.slowestMs) : null,
    confusions: { ...(stat.confusions ?? {}) },
  };
}

function displayKey(character) {
  if (character === " ") return "Space";
  if (character === "\n") return "Enter";
  if (character === "\t") return "Tab";
  return character;
}

function isUsableLatency(value) {
  return Number.isFinite(value) && value >= MIN_TIMING_MS && value <= MAX_TIMING_MS;
}

function addTiming(stat, latencyMs) {
  if (!isUsableLatency(latencyMs)) return;
  stat.timedAttempts += 1;
  stat.totalLatencyMs += latencyMs;
  stat.fastestMs = stat.fastestMs === null ? latencyMs : Math.min(stat.fastestMs, latencyMs);
  stat.slowestMs = stat.slowestMs === null ? latencyMs : Math.max(stat.slowestMs, latencyMs);
}

function longestCommonPrefix(a, b) {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  return index;
}

function countPositionMatches(target, typed) {
  let correct = 0;
  const length = Math.min(target.length, typed.length);
  for (let index = 0; index < length; index += 1) {
    if (target[index] === typed[index]) correct += 1;
  }
  return correct;
}

function getWrongPositions(target, typed) {
  const wrong = [];
  const length = Math.min(target.length, typed.length);
  for (let index = 0; index < length; index += 1) {
    if (target[index] !== typed[index]) wrong.push(index);
  }
  return wrong;
}

function getAverageLatency(stat = {}) {
  const attempts = Number(stat.timedAttempts) || 0;
  return attempts ? (Number(stat.totalLatencyMs) || 0) / attempts : null;
}

function normaliseStats(stats = {}) {
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => {
      const stat = cloneTimingStat(value);
      return [key, {
        ...stat,
        averageLatencyMs: getAverageLatency(stat),
      }];
    }),
  );
}

function calculateBurstWpm(events = [], windowMs = BURST_WINDOW_MS) {
  const usable = events
    .filter((event) => event?.correct && Number.isFinite(event?.atMs))
    .sort((a, b) => a.atMs - b.atMs);
  if (usable.length < 5) return 0;

  let left = 0;
  let maxCharacters = 0;
  for (let right = 0; right < usable.length; right += 1) {
    while (usable[right].atMs - usable[left].atMs > windowMs) left += 1;
    maxCharacters = Math.max(maxCharacters, right - left + 1);
  }

  return (maxCharacters / 5) / (windowMs / 60000);
}

export function createTypingTelemetry(target = "") {
  return {
    target,
    typed: "",
    characterInputs: 0,
    correctInputs: 0,
    incorrectInputs: 0,
    correctionActions: 0,
    deletedCharacters: 0,
    correctedErrors: 0,
    keyStats: {},
    bigramStats: {},
    confusionMatrix: {},
    inputEvents: [],
    lastInputAtMs: null,
    pauseCount: 0,
    pauseReasons: {},
    focusLossCount: 0,
    rejectedEdits: 0,
    compositionCommits: 0,
    invalidReasons: [],
  };
}

function recordCharacter(telemetry, actual, elapsedMs) {
  const position = telemetry.typed.length;
  if (position >= telemetry.target.length) return false;

  const expected = telemetry.target[position];
  const expectedKey = displayKey(expected);
  const actualKey = displayKey(actual);
  const correct = actual === expected;
  const latencyMs = telemetry.lastInputAtMs === null ? null : elapsedMs - telemetry.lastInputAtMs;

  const keyStat = telemetry.keyStats[expectedKey] ?? createTimingStat();
  keyStat.attempts += 1;
  if (correct) keyStat.correct += 1;
  else {
    keyStat.errors += 1;
    keyStat.confusions[actualKey] = (keyStat.confusions[actualKey] || 0) + 1;
    const expectedConfusions = telemetry.confusionMatrix[expectedKey] ?? {};
    expectedConfusions[actualKey] = (expectedConfusions[actualKey] || 0) + 1;
    telemetry.confusionMatrix[expectedKey] = expectedConfusions;
  }
  addTiming(keyStat, latencyMs);
  telemetry.keyStats[expectedKey] = keyStat;

  if (position > 0) {
    const previousExpected = telemetry.target[position - 1];
    const previousActual = telemetry.typed[position - 1];
    const bigram = `${previousExpected}${expected}`;
    const bigramStat = telemetry.bigramStats[bigram] ?? createTimingStat();
    const bigramCorrect = previousActual === previousExpected && correct;
    bigramStat.attempts += 1;
    if (bigramCorrect) bigramStat.correct += 1;
    else bigramStat.errors += 1;
    addTiming(bigramStat, latencyMs);
    telemetry.bigramStats[bigram] = bigramStat;
  }

  telemetry.characterInputs += 1;
  if (correct) telemetry.correctInputs += 1;
  else telemetry.incorrectInputs += 1;
  telemetry.typed += actual;
  telemetry.lastInputAtMs = elapsedMs;
  telemetry.inputEvents.push({ atMs: elapsedMs, correct });
  return true;
}

function getErrorsInRange(target, typed, start, end) {
  let errors = 0;
  for (let index = start; index < end; index += 1) {
    if (typed[index] !== target[index]) errors += 1;
  }
  return errors;
}

function applyDeletion(telemetry, requestedPrefixLength, backspaceMode) {
  const current = telemetry.typed;
  if (requestedPrefixLength >= current.length) return current;
  if (backspaceMode === "disabled") {
    telemetry.rejectedEdits += 1;
    return current;
  }

  let acceptedPrefixLength = Math.max(0, requestedPrefixLength);
  if (backspaceMode === "errors-only") {
    let firstProtectedPosition = current.length;
    while (
      firstProtectedPosition > acceptedPrefixLength
      && current[firstProtectedPosition - 1] !== telemetry.target[firstProtectedPosition - 1]
    ) {
      firstProtectedPosition -= 1;
    }
    acceptedPrefixLength = firstProtectedPosition;
    if (acceptedPrefixLength > requestedPrefixLength) telemetry.rejectedEdits += 1;
  }

  const deletedCount = current.length - acceptedPrefixLength;
  if (deletedCount <= 0) return current;

  telemetry.correctionActions += 1;
  telemetry.deletedCharacters += deletedCount;
  telemetry.correctedErrors += getErrorsInRange(
    telemetry.target,
    current,
    acceptedPrefixLength,
    current.length,
  );
  telemetry.typed = current.slice(0, acceptedPrefixLength);
  telemetry.lastInputAtMs = null;
  return telemetry.typed;
}

export function applyInputChange(
  telemetry,
  nextValue,
  elapsedMs,
  {
    backspaceMode = "allowed",
    inputType = "insertText",
    isCompositionCommit = false,
  } = {},
) {
  const current = telemetry.typed;
  const requested = String(nextValue ?? "");
  if (requested === current) return { acceptedValue: current, changed: false };

  const prefixLength = longestCommonPrefix(current, requested);
  const hasDeletion = prefixLength < current.length;
  const insertion = requested.slice(prefixLength);

  if (hasDeletion) applyDeletion(telemetry, prefixLength, backspaceMode);

  if (insertion && telemetry.typed.length !== prefixLength) {
    return { acceptedValue: telemetry.typed, changed: telemetry.typed !== current };
  }

  if (isCompositionCommit) telemetry.compositionCommits += 1;
  let insertedCount = 0;
  for (const character of insertion) {
    if (!recordCharacter(telemetry, character, elapsedMs)) break;
    insertedCount += 1;
  }

  if (inputType === "insertFromPaste" || inputType === "insertFromDrop") {
    telemetry.invalidReasons.push("Pasted or dropped text was detected.");
  }

  return {
    acceptedValue: telemetry.typed,
    changed: telemetry.typed !== current,
    insertedCount,
    deletedCount: Math.max(0, current.length - prefixLength),
  };
}

export function registerPause(telemetry, reason = "manual") {
  telemetry.pauseCount += 1;
  telemetry.pauseReasons[reason] = (telemetry.pauseReasons[reason] || 0) + 1;
  if (reason === "focus-loss" || reason === "visibility") telemetry.focusLossCount += 1;
  telemetry.lastInputAtMs = null;
}

export function addInvalidReason(telemetry, reason) {
  if (reason && !telemetry.invalidReasons.includes(reason)) telemetry.invalidReasons.push(reason);
}

export function getTypingMetrics(telemetry, elapsedMs) {
  const safeElapsedMs = Math.max(Number(elapsedMs) || 0, 1);
  const minutes = safeElapsedMs / 60000;
  const typed = telemetry.typed;
  const correctCharacters = countPositionMatches(telemetry.target, typed);
  const wrongPositions = getWrongPositions(telemetry.target, typed);
  const grossWpm = telemetry.characterInputs > 0
    ? (telemetry.characterInputs / 5) / minutes
    : 0;
  const netWpm = correctCharacters > 0
    ? (correctCharacters / 5) / minutes
    : 0;
  const keystrokeAccuracy = telemetry.characterInputs > 0
    ? (telemetry.correctInputs / telemetry.characterInputs) * 100
    : 100;
  const finalTextAccuracy = typed.length > 0
    ? (correctCharacters / typed.length) * 100
    : 100;
  const correctionRate = telemetry.incorrectInputs > 0
    ? (telemetry.correctedErrors / telemetry.incorrectInputs) * 100
    : 0;

  return {
    grossWpm,
    rawWpm: grossWpm,
    netWpm,
    sustainedWpm: netWpm,
    burstWpm: calculateBurstWpm(telemetry.inputEvents),
    accuracy: clamp(keystrokeAccuracy, 0, 100),
    keystrokeAccuracy: clamp(keystrokeAccuracy, 0, 100),
    finalTextAccuracy: clamp(finalTextAccuracy, 0, 100),
    correctionRate: clamp(correctionRate, 0, 100),
    errors: telemetry.incorrectInputs,
    uncorrectedErrors: wrongPositions.length,
    correctedErrors: telemetry.correctedErrors,
    correctionActions: telemetry.correctionActions,
    backspaces: telemetry.correctionActions,
    deletedCharacters: telemetry.deletedCharacters,
    completion: telemetry.target.length
      ? clamp((typed.length / telemetry.target.length) * 100, 0, 100)
      : 0,
    charactersTyped: typed.length,
    characterInputs: telemetry.characterInputs,
    correctCharacters,
    charactersPerMinute: telemetry.characterInputs / minutes,
  };
}

export function evaluateBenchmarkValidity(result, policy = null) {
  if (!policy) {
    return {
      benchmarkValid: null,
      personalBestEligible: Boolean(result.validSession),
      validationReasons: result.validSession ? [] : [...(result.invalidReasons ?? [])],
    };
  }

  const reasons = [];
  const expectedDurationSeconds = Number(policy.expectedDurationSeconds) || 0;
  const minimumAccuracy = Number(policy.minimumAccuracy) || 0;
  const minimumCharacters = Number(policy.minimumCharacters) || 5;
  const allowPauses = Boolean(policy.allowPauses);

  if (policy.requireFullDuration !== false && result.reason !== "time") {
    reasons.push("The full benchmark time was not completed.");
  }
  if (expectedDurationSeconds && result.durationSeconds < expectedDurationSeconds - 0.35) {
    reasons.push("The recorded duration was shorter than the benchmark.");
  }
  if (result.characterInputs < minimumCharacters) {
    reasons.push(`At least ${minimumCharacters} typed characters are required.`);
  }
  if (result.keystrokeAccuracy < minimumAccuracy) {
    reasons.push(`At least ${minimumAccuracy}% keystroke accuracy is required.`);
  }
  if (!allowPauses && result.pauseCount > 0) {
    reasons.push("Paused benchmark attempts are saved but cannot set a personal best.");
  }
  for (const reason of result.invalidReasons ?? []) {
    if (!reasons.includes(reason)) reasons.push(reason);
  }

  return {
    benchmarkValid: reasons.length === 0,
    personalBestEligible: reasons.length === 0 && policy.personalBestEligible !== false,
    validationReasons: reasons,
  };
}

function difficultFromStats(stats, limit = 8) {
  return Object.entries(stats)
    .map(([key, stat]) => ({
      key: displayKey(key),
      attempts: Number(stat.attempts) || 0,
      errors: Number(stat.errors) || 0,
      errorRate: stat.attempts ? ((Number(stat.errors) || 0) / stat.attempts) * 100 : 0,
      averageLatencyMs: getAverageLatency(stat),
    }))
    .filter((item) => item.errors > 0)
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
    .slice(0, limit);
}

export function buildSessionResult({
  telemetry,
  elapsedMs,
  paceSamples = [],
  reason = "complete",
  benchmarkPolicy = null,
}) {
  const safeElapsedMs = Math.max(Number(elapsedMs) || 0, 1);
  const metrics = getTypingMetrics(telemetry, safeElapsedMs);
  const mistakeSummary = buildMistakeSummary(telemetry.target, telemetry.typed);
  const invalidReasons = [...new Set(telemetry.invalidReasons)];
  const validSession = !(
    safeElapsedMs < 1500
    && telemetry.characterInputs >= 10
  ) && invalidReasons.length === 0;

  if (!validSession && safeElapsedMs < 1500 && telemetry.characterInputs >= 10) {
    invalidReasons.push("The session ended too quickly to produce a reliable score.");
  }

  const baseResult = {
    ...metrics,
    reason,
    durationSeconds: safeElapsedMs / 1000,
    consistency: calculateConsistency(paceSamples),
    paceSamples: [...paceSamples],
    keyStats: normaliseStats(telemetry.keyStats),
    bigramStats: normaliseStats(telemetry.bigramStats),
    confusionMatrix: typeof structuredClone === "function"
      ? structuredClone(telemetry.confusionMatrix)
      : JSON.parse(JSON.stringify(telemetry.confusionMatrix)),
    mistakeWords: mistakeSummary.words,
    difficultKeys: difficultFromStats(telemetry.keyStats),
    difficultBigrams: difficultFromStats(telemetry.bigramStats, 6),
    targetLength: telemetry.target.length,
    typedText: telemetry.typed,
    pauseCount: telemetry.pauseCount,
    focusLossCount: telemetry.focusLossCount,
    rejectedEdits: telemetry.rejectedEdits,
    compositionCommits: telemetry.compositionCommits,
    invalidReasons,
    validSession,
  };

  return {
    ...baseResult,
    ...evaluateBenchmarkValidity(baseResult, benchmarkPolicy),
  };
}
