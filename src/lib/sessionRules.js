export const PRACTICE_ACCURACY_TARGETS = {
  accuracy: 97,
  recovery: 96,
  adaptive: 95,
  endurance: 95,
  speed: 92,
  smart: 95,
  numbers: 96,
  custom: 95,
  paragraphs: 95,
  default: 94,
};

export function getPracticeAccuracyTarget(config = {}) {
  const hasExplicitTarget = config.accuracyTarget !== null
    && config.accuracyTarget !== undefined
    && config.accuracyTarget !== "";
  const explicitTarget = Number(config.accuracyTarget);
  if (hasExplicitTarget && Number.isFinite(explicitTarget) && explicitTarget >= 0 && explicitTarget <= 100) {
    return explicitTarget;
  }
  if (config.presetId === "accuracy") return PRACTICE_ACCURACY_TARGETS.accuracy;
  if (config.purpose && PRACTICE_ACCURACY_TARGETS[config.purpose] !== undefined) {
    return PRACTICE_ACCURACY_TARGETS[config.purpose];
  }
  return PRACTICE_ACCURACY_TARGETS[config.contentType] ?? PRACTICE_ACCURACY_TARGETS.default;
}

export function getBenchmarkPolicy(test = {}) {
  const durationSeconds = Math.max(1, Number(test.durationSeconds) || 60);
  const minimumAccuracy = test.assessment?.mode === "level"
    ? 90
    : test.id === "accuracy-120"
      ? 95
      : 90;

  return {
    expectedDurationSeconds: durationSeconds,
    minimumAccuracy,
    minimumCharacters: Math.max(5, Math.round(durationSeconds / 3)),
    requireFullDuration: true,
    allowPauses: false,
    personalBestEligible: test.personalBestEligible !== false,
  };
}

export function getDiagnosticPolicy(durationSeconds = 120) {
  return {
    expectedDurationSeconds: durationSeconds,
    minimumAccuracy: 0,
    minimumCharacters: 20,
    requireFullDuration: true,
    allowPauses: false,
  };
}
