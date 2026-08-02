import { upgradeLegacyMastery } from "./adaptiveLearning.js";
import { lessons } from "../data/curriculum.js";
import {
  COMPACT_ATTEMPT_LIMIT,
  compactAttemptSummary,
  saveAttemptDetails,
} from "./historyStore.js";

export const LEGACY_STORAGE_KEY = "typing-master:v1";
export const GUEST_STORAGE_KEY = "typing-master:guest";
export const USER_STORAGE_PREFIX = "typing-master:user:";
export const STORAGE_KEY = GUEST_STORAGE_KEY;
export const DATA_VERSION = 9;

const nowIso = () => new Date().toISOString();

export const DEFAULT_SETTINGS = {
  theme: "system",
  dailyGoalMinutes: 15,
  soundEnabled: false,
  showKeyboard: true,
  showLiveWpm: true,
  showLiveAccuracy: true,
  reduceMotion: false,
  autoPause: true,
  backspaceMode: "allowed",
  textSize: "medium",
  caretStyle: "bar",
};

export const DEFAULT_PRACTICE_CONFIG = {
  purpose: "adaptive",
  contentType: "words",
  category: "general",
  goalType: "time",
  durationSeconds: 300,
  wordCount: 100,
  difficulty: "balanced",
  documentStyle: "mixed",
  progressiveFeatures: false,
  punctuation: false,
  capitals: false,
  numbers: false,
  customText: "",
  lessonId: null,
  targetDensity: 0.38,
  focusKeys: [],
  focusBigrams: [],
  recoveryWords: [],
  confusionPairs: [],
};

export const DEFAULT_APP_DATA = {
  version: DATA_VERSION,
  profile: {
    name: "Learner",
    joinedAt: nowIso(),
    experience: "beginner",
    primaryGoal: "accuracy",
  },
  settings: DEFAULT_SETTINGS,
  onboarding: {
    completed: false,
    diagnosticCompleted: false,
    diagnosticResult: null,
  },
  adaptive: {
    placement: {
      source: "setup",
      level: "Foundation",
      startLessonId: "home-f-j",
      creditedLessonIds: [],
      rationale: "Start with the complete touch-typing foundation.",
      confidence: "high",
      placedAt: null,
      diagnostic: null,
    },
  },
  progress: {
    activeCourseId: "touch-typing-path",
    activeLessonId: "home-f-j",
    completedLessons: [],
    lessonMastery: {},
    totalPracticeSeconds: 0,
    totalSessions: 0,
    totalCharacters: 0,
    totalCorrectCharacters: 0,
    bestWpm: 0,
    averageWpm: 0,
    averageAccuracy: 0,
    averageConsistency: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastPracticeDate: null,
  },
  statistics: {
    keyStats: {},
    bigramStats: {},
    wordStats: {},
    dailyActivity: {},
    practiceContentHistory: [],
  },
  personalBests: {},
  attempts: [],
  lastPracticeConfig: DEFAULT_PRACTICE_CONFIG,
  savedCustomTexts: [],
  storage: {
    schemaVersion: 1,
    compactedAt: null,
  },
};

function cloneDefault() {
  return typeof structuredClone === "function"
    ? structuredClone(DEFAULT_APP_DATA)
    : JSON.parse(JSON.stringify(DEFAULT_APP_DATA));
}

function asFinite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function asEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function asText(value, fallback = "", limit = 200) {
  return typeof value === "string" ? value.trim().slice(0, limit) : fallback;
}

function normalizePlacement(savedPlacement = {}) {
  const source = String(savedPlacement.source || "setup");
  const diagnosticPlacement = source.startsWith("diagnostic");
  const checkpointIndex = lessons.findIndex((lesson) => lesson.id === "capital-letters");
  const safeCreditIds = new Set(lessons.slice(0, Math.max(0, checkpointIndex)).map((lesson) => lesson.id));
  const creditedLessonIds = [...new Set(asArray(savedPlacement.creditedLessonIds).filter(Boolean))]
    .filter((lessonId) => !diagnosticPlacement || safeCreditIds.has(lessonId));
  const requestedIndex = lessons.findIndex((lesson) => lesson.id === savedPlacement.startLessonId);
  const startLessonId = diagnosticPlacement && requestedIndex > checkpointIndex
    ? "capital-letters"
    : savedPlacement.startLessonId;

  return {
    ...savedPlacement,
    startLessonId: startLessonId || "home-f-j",
    creditedLessonIds,
    rationale: diagnosticPlacement && requestedIndex > checkpointIndex
      ? "Earlier diagnostic credit was corrected because the general-text test did not directly verify capitals, punctuation, or number-row control."
      : savedPlacement.rationale,
  };
}

function mergeData(saved = {}) {
  saved = asObject(saved);
  const fresh = cloneDefault();
  const savedProfile = asObject(saved.profile);
  const savedSettings = asObject(saved.settings);
  const savedOnboarding = asObject(saved.onboarding);
  const savedAdaptive = asObject(saved.adaptive);
  const progress = asObject(saved.progress);
  const statistics = asObject(saved.statistics);
  const completedLessons = [...new Set(asArray(progress.completedLessons).filter(Boolean))];
  const rawMastery = progress.lessonMastery && typeof progress.lessonMastery === "object"
    ? progress.lessonMastery
    : {};
  const lessonIds = new Set([...Object.keys(rawMastery), ...completedLessons]);
  const lessonMastery = Object.fromEntries(
    [...lessonIds].map((lessonId) => [
      lessonId,
      upgradeLegacyMastery(rawMastery[lessonId] ?? {}, lessonId, completedLessons.includes(lessonId)),
    ]),
  );
  const placement = normalizePlacement({
    ...fresh.adaptive.placement,
    ...(saved.adaptive?.placement ?? {}),
  });
  const rawPlacementStart = saved.adaptive?.placement?.startLessonId;
  const activeLessonId = progress.activeLessonId === rawPlacementStart
    && rawPlacementStart !== placement.startLessonId
    ? placement.startLessonId
    : progress.activeLessonId;

  return {
    ...fresh,
    ...saved,
    version: DATA_VERSION,
    profile: {
      ...fresh.profile,
      name: asText(savedProfile.name, fresh.profile.name, 40) || fresh.profile.name,
      joinedAt: asText(savedProfile.joinedAt, fresh.profile.joinedAt, 40),
      experience: asEnum(savedProfile.experience, ["beginner", "hunt-and-peck", "touch-typist"], fresh.profile.experience),
      primaryGoal: asEnum(savedProfile.primaryGoal, ["accuracy", "speed", "work"], fresh.profile.primaryGoal),
    },
    settings: {
      ...fresh.settings,
      theme: asEnum(savedSettings.theme, ["system", "light", "dark"], fresh.settings.theme),
      dailyGoalMinutes: [5, 10, 15, 20].includes(Number(savedSettings.dailyGoalMinutes))
        ? Number(savedSettings.dailyGoalMinutes)
        : fresh.settings.dailyGoalMinutes,
      soundEnabled: asBoolean(savedSettings.soundEnabled, fresh.settings.soundEnabled),
      showKeyboard: asBoolean(savedSettings.showKeyboard, fresh.settings.showKeyboard),
      showLiveWpm: asBoolean(savedSettings.showLiveWpm, fresh.settings.showLiveWpm),
      showLiveAccuracy: asBoolean(savedSettings.showLiveAccuracy, fresh.settings.showLiveAccuracy),
      reduceMotion: asBoolean(savedSettings.reduceMotion, fresh.settings.reduceMotion),
      autoPause: asBoolean(savedSettings.autoPause, fresh.settings.autoPause),
      backspaceMode: asEnum(savedSettings.backspaceMode, ["allowed", "errors-only", "disabled"], fresh.settings.backspaceMode),
      textSize: asEnum(savedSettings.textSize, ["small", "medium", "large"], fresh.settings.textSize),
      caretStyle: asEnum(savedSettings.caretStyle, ["bar", "block", "underline"], fresh.settings.caretStyle),
    },
    onboarding: {
      ...fresh.onboarding,
      completed: asBoolean(savedOnboarding.completed, fresh.onboarding.completed),
      diagnosticCompleted: asBoolean(savedOnboarding.diagnosticCompleted, fresh.onboarding.diagnosticCompleted),
      diagnosticResult: savedOnboarding.diagnosticResult && typeof savedOnboarding.diagnosticResult === "object"
        ? savedOnboarding.diagnosticResult
        : null,
    },
    adaptive: {
      ...fresh.adaptive,
      ...savedAdaptive,
      placement,
    },
    progress: {
      ...fresh.progress,
      ...progress,
      completedLessons,
      lessonMastery,
      activeLessonId: activeLessonId || placement.startLessonId,
      totalPracticeSeconds: asFinite(progress.totalPracticeSeconds),
      totalSessions: asFinite(progress.totalSessions),
      totalCharacters: asFinite(progress.totalCharacters),
      totalCorrectCharacters: asFinite(progress.totalCorrectCharacters),
      bestWpm: asFinite(progress.bestWpm),
      averageWpm: asFinite(progress.averageWpm),
      averageAccuracy: asFinite(progress.averageAccuracy),
      averageConsistency: asFinite(progress.averageConsistency),
      currentStreak: asFinite(progress.currentStreak),
      longestStreak: asFinite(progress.longestStreak),
    },
    statistics: {
      ...fresh.statistics,
      ...statistics,
      keyStats: statistics.keyStats && typeof statistics.keyStats === "object"
        ? statistics.keyStats
        : {},
      bigramStats: statistics.bigramStats && typeof statistics.bigramStats === "object"
        ? statistics.bigramStats
        : {},
      wordStats: statistics.wordStats && typeof statistics.wordStats === "object"
        ? statistics.wordStats
        : {},
      dailyActivity: statistics.dailyActivity && typeof statistics.dailyActivity === "object"
        ? statistics.dailyActivity
        : {},
      practiceContentHistory: asArray(statistics.practiceContentHistory)
        .filter((item) => item && typeof item === "object")
        .slice(0, 20),
    },
    personalBests: saved.personalBests && typeof saved.personalBests === "object"
      ? saved.personalBests
      : {},
    attempts: asArray(saved.attempts)
      .filter((item) => item?.id)
      .slice(0, COMPACT_ATTEMPT_LIMIT),
    lastPracticeConfig: (() => {
      const savedConfig = asObject(saved.lastPracticeConfig);
      const legacySmart = savedConfig.contentType === "smart";
      return {
        ...fresh.lastPracticeConfig,
        ...savedConfig,
        purpose: savedConfig.purpose || (legacySmart ? "adaptive" : fresh.lastPracticeConfig.purpose),
        contentType: legacySmart ? "words" : (savedConfig.contentType || fresh.lastPracticeConfig.contentType),
        focusKeys: asArray(savedConfig.focusKeys).filter(Boolean).slice(0, 12),
        focusBigrams: asArray(savedConfig.focusBigrams).filter(Boolean).slice(0, 12),
        recoveryWords: asArray(savedConfig.recoveryWords).filter(Boolean).slice(0, 20),
        confusionPairs: asArray(savedConfig.confusionPairs).filter(Boolean).slice(0, 12),
      };
    })(),
    savedCustomTexts: asArray(saved.savedCustomTexts)
      .map((item) => asObject(item))
      .filter((item) => typeof item.id === "string" && typeof item.text === "string" && item.text.trim())
      .map((item) => ({
        id: item.id.slice(0, 100),
        title: asText(item.title, "Custom text", 120) || "Custom text",
        text: item.text.trim().slice(0, 12000),
        createdAt: asText(item.createdAt, nowIso(), 40),
      }))
      .slice(0, 20),
    storage: {
      ...fresh.storage,
      ...asObject(saved.storage),
      schemaVersion: 1,
    },
  };
}

export function createFreshAppData() {
  const data = cloneDefault();
  data.profile.joinedAt = nowIso();
  return data;
}

function defaultStorage() {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

export function getAppStorageKey(userId = null) {
  return userId ? `${USER_STORAGE_PREFIX}${userId}` : GUEST_STORAGE_KEY;
}

function migrateLegacyGuestData(storage) {
  if (!storage) return;
  if (!storage.getItem(GUEST_STORAGE_KEY)) {
    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) storage.setItem(GUEST_STORAGE_KEY, legacy);
  }
  storage.removeItem(LEGACY_STORAGE_KEY);
}

function containsDetailedAttemptData(attempt = {}) {
  return Boolean(
    attempt.typedText
    || attempt.targetText
    || Object.keys(attempt.keyStats ?? {}).length
    || Object.keys(attempt.bigramStats ?? {}).length
    || (Array.isArray(attempt.paceSamples) && attempt.paceSamples.length)
  );
}

export function compactAppData(data = {}) {
  const merged = mergeData(data);
  const attempts = asArray(merged.attempts)
    .filter((item) => item?.id)
    .map(compactAttemptSummary)
    .slice(0, COMPACT_ATTEMPT_LIMIT);
  const dailyEntries = Object.entries(merged.statistics.dailyActivity ?? {})
    .sort(([first], [second]) => second.localeCompare(first))
    .slice(0, 400);

  return {
    ...merged,
    version: DATA_VERSION,
    attempts,
    statistics: {
      ...merged.statistics,
      dailyActivity: Object.fromEntries(dailyEntries),
      practiceContentHistory: asArray(merged.statistics.practiceContentHistory).slice(0, 20),
    },
    storage: {
      ...merged.storage,
      schemaVersion: 1,
      compactedAt: nowIso(),
    },
  };
}

export function estimateAppDataBytes(data = {}) {
  try {
    const json = JSON.stringify(data);
    return typeof Blob !== "undefined" ? new Blob([json]).size : json.length * 2;
  } catch {
    return 0;
  }
}

export function loadAppData(userId = null, storage = defaultStorage()) {
  try {
    if (!storage) return createFreshAppData();
    if (!userId) migrateLegacyGuestData(storage);
    const raw = storage.getItem(getAppStorageKey(userId));
    if (!raw) return createFreshAppData();
    const parsed = JSON.parse(raw);
    const legacyDetails = asArray(parsed.attempts).filter(containsDetailedAttemptData);
    if (legacyDetails.length) {
      void saveAttemptDetails(userId, legacyDetails).catch((error) => {
        console.warn("Typing Master could not migrate detailed attempt history.", error);
      });
    }
    return compactAppData(parsed);
  } catch (error) {
    console.warn("Typing Master could not read local progress.", error);
    return createFreshAppData();
  }
}

export function saveAppDataWithStatus(data, userId = null, storage = defaultStorage()) {
  try {
    if (!storage) return { ok: false, bytes: 0, error: "Local storage is unavailable." };
    const compact = compactAppData(data);
    const json = JSON.stringify(compact);
    storage.setItem(getAppStorageKey(userId), json);
    return { ok: true, bytes: typeof Blob !== "undefined" ? new Blob([json]).size : json.length * 2, data: compact, error: "" };
  } catch (error) {
    console.warn("Typing Master could not save local progress.", error);
    return { ok: false, bytes: 0, error: error?.message || "Local progress could not be saved." };
  }
}

export function saveAppData(data, userId = null, storage = defaultStorage()) {
  return saveAppDataWithStatus(data, userId, storage).ok;
}

export function clearAppData(userId = null, storage = defaultStorage()) {
  try {
    if (!storage) return;
    storage.removeItem(getAppStorageKey(userId));
  } catch (error) {
    console.warn("Typing Master could not clear local progress.", error);
  }
}

export function validateImportedData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("This file does not contain valid Typing Master data.");
  }
  const version = Number(value.version);
  if (!Number.isFinite(version) || version < 1) {
    throw new Error("The progress file has no supported data version.");
  }
  if (version > DATA_VERSION) {
    throw new Error("This backup was created by a newer Typing Master version. Update the app before importing it.");
  }
  const approxBytes = estimateAppDataBytes(value);
  if (approxBytes > 25 * 1024 * 1024) {
    throw new Error("This progress backup is larger than the safe 25 MB import limit.");
  }
  if (asArray(value.attempts).length > 5000) {
    throw new Error("This progress backup contains too many session records.");
  }
  return mergeData(value);
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
