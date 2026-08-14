import { resolveDifficultyBand, resolveFeatureProgression } from "./motorDifficulty.js";
import { getLessonById } from "../data/curriculum.js";

export const REMEDIATION_VERSION = 1;

const PURPOSE_DEFAULTS = {
  balanced: {
    label: "Balanced practice",
    density: 0.16,
    accuracyTarget: 94,
  },
  adaptive: {
    label: "Adaptive review",
    density: 0.38,
    accuracyTarget: 95,
  },
  accuracy: {
    label: "Accuracy control",
    density: 0.22,
    accuracyTarget: 97,
  },
  speed: {
    label: "Speed development",
    density: 0.12,
    accuracyTarget: 92,
  },
  endurance: {
    label: "Endurance",
    density: 0.14,
    accuracyTarget: 95,
  },
  recovery: {
    label: "Mistake recovery",
    density: 0.55,
    accuracyTarget: 96,
  },
};

const VALID_PURPOSES = new Set(Object.keys(PURPOSE_DEFAULTS));
const VALID_CONTENT_TYPES = new Set(["words", "sentences", "paragraphs", "documents", "numbers", "custom", "lesson"]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function averageLatency(stat = {}) {
  const timedAttempts = Number(stat.timedAttempts) || 0;
  if (!timedAttempts) return null;
  return (Number(stat.totalLatencyMs) || 0) / timedAttempts;
}

function uniqueStrings(values = [], { lower = false } = {}) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const clean = String(value ?? "").trim();
    if (!clean) continue;
    const key = lower ? clean.toLowerCase() : clean;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

function compactReassessmentConfig(config = {}) {
  const fields = [
    "presetId", "purpose", "contentType", "category", "goalType", "durationSeconds",
    "wordCount", "difficulty", "documentStyle", "progressiveFeatures", "punctuation",
    "capitals", "numbers", "customText", "accuracyTarget", "targetDensity", "focusKeys",
    "focusBigrams", "recoveryWords", "confusionPairs",
  ];
  return Object.fromEntries(fields
    .filter((field) => config[field] !== undefined)
    .map((field) => [field, config[field]]));
}

function normaliseRemediationReturn(value) {
  if (!value || typeof value !== "object") return null;
  if (value.kind === "test" && /^\/tests\/[a-z0-9-]+$/i.test(String(value.to || ""))) {
    return {
      kind: "test",
      to: String(value.to),
      label: String(value.label || "typing assessment").slice(0, 80),
    };
  }
  if (value.kind === "lesson" && /^\/learn\/[a-z0-9-]+$/i.test(String(value.to || ""))) {
    const session = value.session && typeof value.session === "object" ? value.session : {};
    return {
      kind: "lesson",
      to: String(value.to),
      label: String(value.label || "lesson check").slice(0, 80),
      session: {
        practiceMode: ["guided", "longer", "timed"].includes(session.practiceMode) ? session.practiceMode : "guided",
        exerciseIndex: Math.max(0, Math.min(20, Math.round(Number(session.exerciseIndex) || 0))),
        wordCount: Math.max(25, Math.min(500, Math.round(Number(session.wordCount) || 100))),
        durationSeconds: Math.max(60, Math.min(600, Math.round(Number(session.durationSeconds) || 180))),
      },
    };
  }
  if (value.kind === "practice" && value.config && typeof value.config === "object") {
    return { kind: "practice", config: compactReassessmentConfig(value.config) };
  }
  return null;
}

function createRemediationId() {
  return `remediation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normaliseKey(value) {
  const key = String(value ?? "").trim();
  if (key === "Space") return " ";
  return key.length === 1 ? key.toLowerCase() : "";
}

function normaliseBigram(value) {
  const clean = String(value ?? "")
    .replaceAll("␣", " ")
    .toLowerCase();
  return clean.length === 2 ? clean : "";
}

function normaliseRemediationAllowedCharacters(value) {
  if (typeof value !== "string") return null;
  const clean = [...value]
    .filter((character) => character === " " || !/[\u0000-\u001F\u007F]/u.test(character))
    .join("")
    .slice(0, 160);
  return clean || null;
}

function isRecoverySequenceAllowed(value, allowedCharacters) {
  if (!allowedCharacters) return true;
  const allowed = new Set([...allowedCharacters]);
  return [...String(value ?? "")].every((character) => allowed.has(character));
}

function sanitiseLessonRecoveryTargets({
  focusKeys = [],
  focusBigrams = [],
  recoveryWords = [],
  confusionPairs = [],
}, allowedCharacters) {
  if (!allowedCharacters) {
    return { focusKeys, focusBigrams, recoveryWords, confusionPairs };
  }

  const safeFocusKeys = focusKeys.filter((key) => isRecoverySequenceAllowed(key, allowedCharacters));
  const safeFocusBigrams = focusBigrams.filter((bigram) => isRecoverySequenceAllowed(bigram, allowedCharacters));
  const safeRecoveryWords = recoveryWords.filter((word) => isRecoverySequenceAllowed(word, allowedCharacters));
  const safeConfusionPairs = [];
  const expectedOnlyKeys = [];

  for (const pair of confusionPairs) {
    const expectedAllowed = isRecoverySequenceAllowed(pair.expected, allowedCharacters);
    const actualAllowed = isRecoverySequenceAllowed(pair.actual, allowedCharacters);
    if (!expectedAllowed) continue;
    if (actualAllowed) {
      safeConfusionPairs.push(pair);
    } else {
      // Keep the expected (learned) key trainable without asking the learner to type
      // the locked key that was pressed by mistake. The raw result still retains that
      // diagnostic confusion for analytics.
      expectedOnlyKeys.push(pair.expected);
    }
  }

  return {
    focusKeys: uniqueStrings([...safeFocusKeys, ...expectedOnlyKeys]),
    focusBigrams: safeFocusBigrams,
    recoveryWords: safeRecoveryWords,
    confusionPairs: safeConfusionPairs,
  };
}

function getPresetPurpose(config = {}) {
  if (config.purpose && VALID_PURPOSES.has(config.purpose)) return config.purpose;
  if (config.contentType === "smart" || config.presetId === "smart") return "adaptive";
  if (config.presetId === "accuracy") return "accuracy";
  if (config.presetId === "sprint") return "speed";
  if (config.presetId === "endurance") return "endurance";
  if (config.focusKeys?.length || config.focusBigrams?.length || config.recoveryWords?.length) return "recovery";
  return "balanced";
}

export function normalisePracticeConfig(config = {}) {
  const purpose = getPresetPurpose(config);
  const legacySmart = config.contentType === "smart";
  const contentType = legacySmart
    ? "words"
    : VALID_CONTENT_TYPES.has(config.contentType)
      ? config.contentType
      : "words";
  const remediationSourceType = ["practice", "test", "lesson"].includes(config.remediationSourceType)
    ? config.remediationSourceType
    : null;
  const remediationSourceId = String(config.remediationSourceId || "").slice(0, 120) || null;
  const sourceLesson = remediationSourceType === "lesson" && remediationSourceId
    ? getLessonById(remediationSourceId)
    : null;
  const remediationAllowedCharacters = remediationSourceType === "lesson"
    ? sourceLesson?.allowedCharacters
      ?? normaliseRemediationAllowedCharacters(config.remediationAllowedCharacters)
    : null;

  const normalisedTargets = sanitiseLessonRecoveryTargets({
    focusKeys: uniqueStrings(config.focusKeys?.map(normaliseKey).filter(Boolean)),
    focusBigrams: uniqueStrings(config.focusBigrams?.map(normaliseBigram).filter((item) => item.length === 2)),
    recoveryWords: uniqueStrings(config.recoveryWords, { lower: true })
      .filter((word) => /^[a-z'-]{2,30}$/i.test(word))
      .slice(0, 20),
    confusionPairs: Array.isArray(config.confusionPairs)
      ? config.confusionPairs
          .map((item) => ({
            expected: normaliseKey(item?.expected),
            actual: normaliseKey(item?.actual),
            count: Math.max(1, Number(item?.count) || 1),
          }))
          .filter((item) => item.expected && item.actual)
          .slice(0, 12)
      : [],
  }, remediationAllowedCharacters);

  return {
    ...config,
    purpose,
    contentType,
    category: config.category || "general",
    goalType: config.goalType === "words" ? "words" : "time",
    durationSeconds: clamp(Number(config.durationSeconds) || 300, 15, 3600),
    wordCount: clamp(Number(config.wordCount) || 100, 10, 5000),
    difficulty: ["easy", "balanced", "hard", "adaptive"].includes(config.difficulty)
      ? config.difficulty
      : "balanced",
    documentStyle: ["mixed", "everyday", "email", "forms", "study", "government", "technology"].includes(config.documentStyle)
      ? config.documentStyle
      : "mixed",
    progressiveFeatures: Boolean(config.progressiveFeatures),
    targetDensity: clamp(
      config.targetDensity ?? PURPOSE_DEFAULTS[purpose].density,
      0.05,
      0.75,
    ),
    focusKeys: normalisedTargets.focusKeys,
    focusBigrams: normalisedTargets.focusBigrams,
    recoveryWords: normalisedTargets.recoveryWords,
    confusionPairs: normalisedTargets.confusionPairs,
    remediationVersion: Number(config.remediationVersion) === REMEDIATION_VERSION
      ? REMEDIATION_VERSION
      : null,
    remediationChainId: String(config.remediationChainId || "").slice(0, 100) || null,
    remediationStage: ["recovery", "reassessment"].includes(config.remediationStage)
      ? config.remediationStage
      : null,
    remediationSourceType,
    remediationSourceId,
    remediationAllowedCharacters,
    remediationReturn: normaliseRemediationReturn(config.remediationReturn),
  };
}

export function getLearnerSkillStage(data = {}) {
  const completed = data.progress?.completedLessons?.length ?? 0;
  const averageWpm = Number(data.progress?.averageWpm) || 0;
  const averageAccuracy = Number(data.progress?.averageAccuracy) || 0;

  if (completed < 6 || averageWpm < 18) return "foundation";
  if (completed < 16 || averageWpm < 32 || averageAccuracy < 91) return "developing";
  if (averageWpm < 50 || averageAccuracy < 94) return "functional";
  return "advanced";
}

export function getAdaptiveKeyTargets(keyStats = {}, limit = 6) {
  return Object.entries(keyStats)
    .map(([rawKey, stat]) => {
      const key = normaliseKey(rawKey);
      const attempts = Number(stat?.attempts) || 0;
      const errors = Number(stat?.errors) || 0;
      const errorRate = attempts ? (errors / attempts) * 100 : 0;
      const latencyMs = averageLatency(stat);
      const latencyPenalty = latencyMs ? Math.max(0, latencyMs - 420) / 28 : 0;
      const confidence = Math.min(1, attempts / 25);
      const score = ((errorRate * 2.2) + (errors * 1.8) + latencyPenalty) * (0.45 + (confidence * 0.55));
      return { key, attempts, errors, errorRate, latencyMs, score };
    })
    .filter((item) => item.key && item.attempts >= 4 && (item.errors > 0 || (item.latencyMs ?? 0) >= 620))
    .sort((a, b) => b.score - a.score || b.errors - a.errors)
    .slice(0, limit);
}

export function getAdaptiveBigramTargets(bigramStats = {}, limit = 6) {
  return Object.entries(bigramStats)
    .map(([rawKey, stat]) => {
      const key = normaliseBigram(rawKey);
      const attempts = Number(stat?.attempts) || 0;
      const errors = Number(stat?.errors) || 0;
      const errorRate = attempts ? (errors / attempts) * 100 : 0;
      const latencyMs = averageLatency(stat);
      const latencyPenalty = latencyMs ? Math.max(0, latencyMs - 520) / 24 : 0;
      const score = (errorRate * 2.4) + (errors * 2) + latencyPenalty;
      return { key, attempts, errors, errorRate, latencyMs, score };
    })
    .filter((item) => item.key.length === 2 && item.attempts >= 3 && (item.errors > 0 || (item.latencyMs ?? 0) >= 720))
    .sort((a, b) => b.score - a.score || b.errors - a.errors)
    .slice(0, limit);
}

export function getConfusionTargets(keyStats = {}, limit = 5) {
  const pairs = [];
  Object.entries(keyStats).forEach(([rawExpected, stat]) => {
    const expected = normaliseKey(rawExpected);
    if (!expected) return;
    Object.entries(stat?.confusions ?? {}).forEach(([rawActual, count]) => {
      const actual = normaliseKey(rawActual);
      const safeCount = Number(count) || 0;
      if (!actual || actual === expected || safeCount <= 0) return;
      pairs.push({ expected, actual, count: safeCount, score: safeCount });
    });
  });
  return pairs
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getRecoveryWordTargets(wordStats = {}, limit = 8) {
  return Object.entries(wordStats)
    .map(([word, stat]) => ({
      word: String(word).trim().toLowerCase(),
      errors: Number(stat?.errors) || 0,
      lastPractisedAt: stat?.lastPractisedAt || null,
    }))
    .filter((item) => item.word && item.errors > 0 && /^[a-z'-]+$/i.test(item.word))
    .sort((a, b) => b.errors - a.errors || String(b.lastPractisedAt).localeCompare(String(a.lastPractisedAt)))
    .slice(0, limit);
}

function getRecentExclusions(history = [], config = {}) {
  const items = [];
  const fingerprints = [];
  for (const entry of history.slice(0, 10)) {
    if (!entry) continue;
    const sameFamily = !entry.contentType || entry.contentType === config.contentType;
    const sameCategory = !entry.category || entry.category === config.category;
    if (!sameFamily || !sameCategory) continue;
    fingerprints.push(entry.fingerprint);
    items.push(...(Array.isArray(entry.items) ? entry.items : []));
  }
  return {
    fingerprints: uniqueStrings(fingerprints).slice(0, 10),
    items: uniqueStrings(items, { lower: true }).slice(0, 160),
  };
}

function getPurposeSummary(purpose) {
  return PURPOSE_DEFAULTS[purpose] ?? PURPOSE_DEFAULTS.balanced;
}

function densityLabel(value) {
  if (value >= 0.5) return "intensive";
  if (value >= 0.32) return "focused";
  if (value >= 0.2) return "moderate";
  return "light";
}

export function buildPracticeRecipe(config = {}, data = {}) {
  const normalised = normalisePracticeConfig(config);
  const lessonBoundary = normalised.remediationSourceType === "lesson"
    ? normalised.remediationAllowedCharacters
    : null;
  const rawKeyTargets = getAdaptiveKeyTargets(data.statistics?.keyStats, 8);
  const rawBigramTargets = getAdaptiveBigramTargets(data.statistics?.bigramStats, 8);
  const rawConfusionTargets = getConfusionTargets(data.statistics?.keyStats, 12);
  const rawRecoveryTargets = getRecoveryWordTargets(data.statistics?.wordStats, 10);
  const keyTargets = rawKeyTargets.filter((item) => isRecoverySequenceAllowed(item.key, lessonBoundary));
  const bigramTargets = rawBigramTargets.filter((item) => isRecoverySequenceAllowed(item.key, lessonBoundary));
  const confusionTargets = rawConfusionTargets
    .filter((item) => isRecoverySequenceAllowed(item.expected, lessonBoundary)
      && isRecoverySequenceAllowed(item.actual, lessonBoundary))
    .slice(0, 6);
  const expectedOnlyConfusionKeys = uniqueStrings(rawConfusionTargets
    .filter((item) => isRecoverySequenceAllowed(item.expected, lessonBoundary)
      && !isRecoverySequenceAllowed(item.actual, lessonBoundary))
    .map((item) => item.expected));
  const recoveryTargets = rawRecoveryTargets.filter((item) => isRecoverySequenceAllowed(item.word, lessonBoundary));

  const explicitFocus = normalised.focusKeys.length
    || normalised.focusBigrams.length
    || normalised.confusionPairs.length
    || normalised.recoveryWords.length;
  const shouldAdapt = ["adaptive", "recovery"].includes(normalised.purpose);

  const focusKeys = normalised.focusKeys.length
    ? normalised.focusKeys
    : shouldAdapt
      ? uniqueStrings([
          ...expectedOnlyConfusionKeys,
          ...keyTargets.slice(0, 5).map((item) => item.key),
        ]).slice(0, 5)
      : [];
  const focusBigrams = normalised.focusBigrams.length
    ? normalised.focusBigrams
    : shouldAdapt
      ? bigramTargets.slice(0, 5).map((item) => item.key)
      : [];
  const confusionPairs = normalised.confusionPairs.length
    ? normalised.confusionPairs
    : shouldAdapt
      ? confusionTargets.slice(0, 4)
      : [];
  const recoveryWords = normalised.recoveryWords.length
    ? normalised.recoveryWords
    : shouldAdapt
      ? recoveryTargets.slice(0, 8).map((item) => item.word)
      : [];

  const recentExclusions = getRecentExclusions(
    data.statistics?.practiceContentHistory ?? [],
    normalised,
  );
  const purposeMeta = getPurposeSummary(normalised.purpose);
  const skillStage = getLearnerSkillStage(data);
  const targetDensity = clamp(
    explicitFocus ? Math.max(normalised.targetDensity, 0.42) : normalised.targetDensity,
    0.05,
    0.75,
  );
  const difficultyTarget = resolveDifficultyBand(normalised.difficulty, skillStage);
  const featurePolicy = resolveFeatureProgression({ ...normalised, skillStage });

  const focusParts = [];
  if (focusKeys.length) focusParts.push(`keys ${focusKeys.map((key) => key === " " ? "Space" : key).join(", ")}`);
  if (focusBigrams.length) focusParts.push(`pairs ${focusBigrams.map((item) => item.replaceAll(" ", "␣")).join(", ")}`);
  if (recoveryWords.length) focusParts.push(`${recoveryWords.length} recovery words`);
  if (confusionPairs.length) focusParts.push(`${confusionPairs.length} key confusions`);

  return {
    ...normalised,
    recipeVersion: 2,
    skillStage,
    focusKeys,
    focusBigrams,
    confusionPairs,
    recoveryWords,
    targetDensity,
    densityLabel: densityLabel(targetDensity),
    difficultyTarget,
    featurePolicy,
    recentExclusions,
    hasAdaptiveEvidence: Boolean(keyTargets.length || bigramTargets.length || confusionTargets.length || recoveryTargets.length),
    purposeLabel: purposeMeta.label,
    accuracyTarget: normalised.accuracyTarget ?? null,
    recommendedAccuracyTarget: purposeMeta.accuracyTarget,
    summary: focusParts.length
      ? `${purposeMeta.label} with ${densityLabel(targetDensity)} emphasis on ${focusParts.join("; ")}.`
      : `${purposeMeta.label} using a ${normalised.difficulty === "adaptive" ? skillStage : normalised.difficulty} motor-difficulty mix.`,
    evidence: {
      weakKeys: keyTargets,
      weakBigrams: bigramTargets,
      confusions: confusionTargets,
      recoveryWords: recoveryTargets,
    },
  };
}

export function buildRecoveryConfig(result = {}, previousConfig = {}, context = {}) {
  const focusKeys = uniqueStrings(
    (result.difficultKeys ?? [])
      .map((item) => normaliseKey(item.key))
      .filter(Boolean),
  ).slice(0, 6);
  const focusBigrams = uniqueStrings(
    (result.difficultBigrams ?? [])
      .map((item) => normaliseBigram(item.key))
      .filter((item) => item.length === 2),
  ).slice(0, 6);
  const recoveryWords = uniqueStrings(
    (result.mistakeWords ?? []).map((item) => item.expected),
    { lower: true },
  ).slice(0, 12);
  const confusionPairs = [];
  Object.entries(result.confusionMatrix ?? {}).forEach(([expected, actuals]) => {
    Object.entries(actuals ?? {}).forEach(([actual, count]) => {
      const pair = {
        expected: normaliseKey(expected),
        actual: normaliseKey(actual),
        count: Number(count) || 1,
      };
      if (pair.expected && pair.actual && pair.expected !== pair.actual) confusionPairs.push(pair);
    });
  });
  confusionPairs.sort((a, b) => b.count - a.count);

  const existingReturn = normaliseRemediationReturn(previousConfig.remediationReturn);
  const reassessmentTarget = existingReturn
    ?? normaliseRemediationReturn(context.returnTarget)
    ?? {
      kind: "practice",
      config: compactReassessmentConfig({
        ...previousConfig,
        purpose: previousConfig.purpose === "recovery" ? "balanced" : previousConfig.purpose,
      }),
    };
  const chainId = previousConfig.remediationChainId
    || String(context.chainId || "").slice(0, 100)
    || createRemediationId();
  const remediationSourceType = context.sourceType || previousConfig.remediationSourceType || "practice";
  const remediationAllowedCharacters = remediationSourceType === "lesson"
    ? context.allowedCharacters ?? previousConfig.remediationAllowedCharacters ?? null
    : null;

  return normalisePracticeConfig({
    ...previousConfig,
    purpose: "recovery",
    contentType: "words",
    presetId: "recovery",
    goalType: "time",
    durationSeconds: 180,
    difficulty: "adaptive",
    targetDensity: 0.58,
    accuracyTarget: null,
    focusKeys,
    focusBigrams,
    recoveryWords,
    confusionPairs: confusionPairs.slice(0, 8),
    remediationVersion: REMEDIATION_VERSION,
    remediationChainId: chainId,
    remediationStage: "recovery",
    remediationSourceType,
    remediationSourceId: context.sourceId || previousConfig.remediationSourceId || null,
    remediationAllowedCharacters,
    remediationReturn: reassessmentTarget,
  });
}

export function getPurposeOptions() {
  return [
    { value: "balanced", label: "Balanced", description: "A varied everyday session without heavy targeting." },
    { value: "adaptive", label: "Adaptive", description: "Uses saved weak keys, pairs, confusions, and words." },
    { value: "accuracy", label: "Accuracy", description: "Controlled vocabulary with a strict 97% target." },
    { value: "speed", label: "Speed", description: "Familiar text for short, smooth bursts." },
    { value: "endurance", label: "Endurance", description: "Longer natural text for sustainable rhythm." },
  ];
}

export function getRecipeFocusPreview(data = {}) {
  return {
    keys: getAdaptiveKeyTargets(data.statistics?.keyStats, 5),
    bigrams: getAdaptiveBigramTargets(data.statistics?.bigramStats, 4),
    confusions: getConfusionTargets(data.statistics?.keyStats, 3),
    words: getRecoveryWordTargets(data.statistics?.wordStats, 5),
  };
}
