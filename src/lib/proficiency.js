export const PROFICIENCY_STANDARD_VERSION = 1;

export const COURSE_PROFICIENCY_LEVELS = [
  {
    id: "foundation",
    label: "Foundation",
    rank: 1,
    minimumWpm: 25,
    minimumAccuracy: 95,
    minimumDurationSeconds: 180,
    description: "Controlled touch typing at a useful learning pace.",
  },
  {
    id: "functional",
    label: "Functional",
    rank: 2,
    minimumWpm: 40,
    minimumAccuracy: 96,
    minimumDurationSeconds: 180,
    description: "Reliable everyday typing sustained across practical text.",
  },
  {
    id: "proficient",
    label: "Proficient",
    rank: 3,
    minimumWpm: 55,
    minimumAccuracy: 97,
    minimumDurationSeconds: 300,
    description: "Fast, accurate typing sustained for a full five minutes.",
  },
];

const DEVELOPING_LEVEL = {
  id: "developing",
  label: "Developing",
  rank: 0,
  minimumWpm: 0,
  minimumAccuracy: 0,
  minimumDurationSeconds: 0,
  description: "A baseline is established; control or pace is still being built.",
};

const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function getAccuracyBand(accuracy = 0) {
  const value = asNumber(accuracy);
  if (value >= 97) return { id: "reliable", label: "Reliable accuracy", minimumAccuracy: 97 };
  if (value >= 95) return { id: "controlled", label: "Controlled accuracy", minimumAccuracy: 95 };
  return { id: "developing", label: "Accuracy developing", minimumAccuracy: 0 };
}

export function getPaceBand(wpm = 0) {
  const value = asNumber(wpm);
  const level = [...COURSE_PROFICIENCY_LEVELS]
    .reverse()
    .find((item) => value >= item.minimumWpm);
  return level
    ? { id: level.id, label: `${level.label} pace`, minimumWpm: level.minimumWpm }
    : { id: "developing", label: "Pace developing", minimumWpm: 0 };
}

function levelById(levelId) {
  if (levelId === DEVELOPING_LEVEL.id) return DEVELOPING_LEVEL;
  return COURSE_PROFICIENCY_LEVELS.find((item) => item.id === levelId) ?? DEVELOPING_LEVEL;
}

function highestEligibleLevel(result, maxLevelId = "proficient", ignoreDuration = false) {
  const wpm = asNumber(result.netWpm);
  const accuracy = asNumber(result.keystrokeAccuracy, asNumber(result.accuracy));
  const durationSeconds = asNumber(result.durationSeconds);
  const maximumRank = levelById(maxLevelId).rank;

  return [...COURSE_PROFICIENCY_LEVELS]
    .reverse()
    .find((level) => (
      level.rank <= maximumRank
      && wpm >= level.minimumWpm
      && accuracy >= level.minimumAccuracy
      && (ignoreDuration || durationSeconds >= level.minimumDurationSeconds - 0.35)
    )) ?? DEVELOPING_LEVEL;
}

function nextLevelFor(level) {
  return COURSE_PROFICIENCY_LEVELS.find((item) => item.rank === level.rank + 1) ?? null;
}

export function classifyCourseProficiency(result = {}, assessment = null) {
  if (!assessment?.mode) return null;

  const valid = result.benchmarkValid === true
    && result.personalBestEligible !== false
    && result.validSession !== false;
  const official = assessment.mode === "level";
  const level = valid ? highestEligibleLevel(result, assessment.maxLevelId, !official) : null;
  const nextLevel = level ? nextLevelFor(level) : null;
  const accuracyBand = getAccuracyBand(result.keystrokeAccuracy ?? result.accuracy);
  const paceBand = getPaceBand(result.netWpm);

  return {
    standardVersion: PROFICIENCY_STANDARD_VERSION,
    valid,
    official,
    mode: assessment.mode,
    maxLevelId: assessment.maxLevelId ?? null,
    levelId: level?.id ?? null,
    levelLabel: level?.label ?? null,
    levelRank: level?.rank ?? null,
    levelDescription: level?.description ?? null,
    accuracyBand,
    paceBand,
    nextLevel,
    note: official
      ? "Typing Master course level — an internal learning measure, not a formal certificate."
      : "Quick estimate only. Take a 3- or 5-minute assessment to record a course level.",
  };
}

export function buildProficiencyAttemptFields(classification) {
  if (!classification) return {};
  return {
    proficiencyStandardVersion: classification.standardVersion,
    proficiencyAssessmentMode: classification.mode,
    proficiencyEligible: classification.official && classification.valid,
    proficiencyLevelId: classification.official && classification.valid ? classification.levelId : null,
    proficiencyLevelLabel: classification.official && classification.valid ? classification.levelLabel : null,
    estimatedProficiencyLevelId: !classification.official && classification.valid ? classification.levelId : null,
    accuracyBandId: classification.accuracyBand.id,
    paceBandId: classification.paceBand.id,
  };
}

export function getProficiencySummary(attempts = []) {
  const eligible = attempts.filter((attempt) => (
    attempt.type === "test"
    && attempt.proficiencyStandardVersion === PROFICIENCY_STANDARD_VERSION
    && attempt.proficiencyEligible === true
    && attempt.benchmarkValid === true
    && attempt.validSession !== false
    && attempt.proficiencyLevelId
  ));

  const ranked = eligible.map((attempt) => ({
    attempt,
    level: levelById(attempt.proficiencyLevelId),
  }));
  ranked.sort((a, b) => (
    b.level.rank - a.level.rank
    || asNumber(b.attempt.netWpm) - asNumber(a.attempt.netWpm)
    || String(b.attempt.completedAt).localeCompare(String(a.attempt.completedAt))
  ));

  const latest = [...ranked].sort((a, b) => (
    String(b.attempt.completedAt).localeCompare(String(a.attempt.completedAt))
  ))[0] ?? null;
  const best = ranked[0] ?? null;

  return {
    count: eligible.length,
    bestLevel: best?.level ?? null,
    bestAttempt: best?.attempt ?? null,
    latestLevel: latest?.level ?? null,
    latestAttempt: latest?.attempt ?? null,
  };
}
