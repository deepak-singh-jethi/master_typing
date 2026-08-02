const DB_NAME = "typing-master-history";
const DB_VERSION = 1;
const ATTEMPT_STORE = "attempt-details";
const SCOPE_INDEX = "scope-completed";

export const RECENT_DETAIL_LIMIT = 200;
export const COMPACT_ATTEMPT_LIMIT = 1000;

const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function getHistoryScope(userId = null) {
  return userId ? `user:${userId}` : "guest";
}

function detailKey(scope, attemptId) {
  return `${scope}:${String(attemptId)}`;
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function estimateBytes(value) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return JSON.stringify(value).length * 2;
  }
}

const SUMMARY_FIELDS = [
  "id", "completedAt", "activityDate", "type", "modeId", "testId", "testTitle",
  "lessonId", "lessonTitle", "exerciseId", "exerciseTitle", "practiceMode",
  "practiceTitle", "practicePurpose", "purpose", "contentType", "presetId",
  "category", "difficulty", "documentStyle", "goalType", "wordCount",
  "plannedDurationSeconds", "durationSeconds", "activeDurationSeconds", "netWpm",
  "rawWpm", "accuracy", "keystrokeAccuracy", "finalTextAccuracy", "consistency",
  "burstWpm", "correctionRate", "charactersTyped", "correctCharacters", "errors",
  "errorCount", "correctedErrors", "correctionActions", "deletedCharacters", "completion",
  "validSession", "benchmarkValid", "validBenchmark", "personalBestEligible", "isPersonalBest",
  "sessionPassed", "reviewAttempt", "accuracyTarget", "reason", "pauseCount",
  "focusLossCount", "rejectedEdits", "compositionCommits", "recipeVersion",
  "curriculumVersion", "contentVersion", "guidedStage",
  "masteryRuleVersion", "unseenTransfer", "reviewScope", "checkpointModuleId",
  "proficiencyStandardVersion", "proficiencyAssessmentMode", "proficiencyEligible",
  "proficiencyLevelId", "proficiencyLevelLabel", "estimatedProficiencyLevelId",
  "accuracyBandId", "paceBandId",
  "remediationVersion", "remediationChainId", "remediationStage",
  "remediationSourceType", "remediationSourceId", "remediationFreshText",
  "recipeSkillStage", "recipeDensity", "generatedFocusDensity", "generatedUniqueRatio",
  "generatedRepeatRate", "generatedMotorBand", "generatedMotorScore", "contentFingerprint",
  "progressiveFeatures", "punctuation", "capitals", "numbers",
];

export function compactAttemptSummary(attempt = {}) {
  const output = {};
  SUMMARY_FIELDS.forEach((field) => {
    if (attempt[field] !== undefined && attempt[field] !== null) output[field] = attempt[field];
  });

  output.id = String(attempt.id || "");
  output.completedAt = attempt.completedAt || new Date().toISOString();
  output.durationSeconds = Math.max(0, number(attempt.durationSeconds));
  output.netWpm = Math.max(0, Math.round(number(attempt.netWpm) * 10) / 10);
  output.accuracy = Math.min(100, Math.max(0, Math.round(number(attempt.accuracy, attempt.keystrokeAccuracy) * 10) / 10));
  output.consistency = Math.min(100, Math.max(0, Math.round(number(attempt.consistency))));
  output.charactersTyped = Math.max(0, Math.round(number(attempt.charactersTyped)));
  output.correctCharacters = Math.max(0, Math.round(number(attempt.correctCharacters)));

  if (array(attempt.focusKeys).length) output.focusKeys = array(attempt.focusKeys).filter(Boolean).slice(0, 12);
  if (array(attempt.recipeFocusKeys).length) output.recipeFocusKeys = array(attempt.recipeFocusKeys).filter(Boolean).slice(0, 12);
  if (array(attempt.recipeFocusBigrams).length) output.recipeFocusBigrams = array(attempt.recipeFocusBigrams).filter(Boolean).slice(0, 12);
  if (array(attempt.difficultBigrams).length) {
    output.difficultBigrams = array(attempt.difficultBigrams)
      .map((item) => typeof item === "string" ? item : item?.key)
      .filter(Boolean)
      .slice(0, 8);
  }
  if (array(attempt.mistakeWords).length) {
    output.mistakeWords = array(attempt.mistakeWords)
      .map((item) => typeof item === "string" ? item : item?.expected)
      .filter(Boolean)
      .slice(0, 12);
  }
  if (array(attempt.invalidReasons).length) output.invalidReasons = array(attempt.invalidReasons).filter(Boolean).slice(0, 6);

  output.detailStored = Boolean(
    attempt.typedText
    || Object.keys(object(attempt.keyStats)).length
    || Object.keys(object(attempt.bigramStats)).length
    || array(attempt.paceSamples).length,
  );
  output.summaryVersion = 1;
  return output;
}

export function buildAttemptDetail(attempt = {}, userId = null) {
  const scope = getHistoryScope(userId);
  const detail = {
    ...clone(attempt),
    id: String(attempt.id || ""),
    scope,
    storageKey: detailKey(scope, attempt.id),
    completedAt: attempt.completedAt || new Date().toISOString(),
    savedAt: new Date().toISOString(),
    detailVersion: 1,
  };
  detail.approxBytes = estimateBytes(detail);
  return detail;
}

export function mergeAttemptDetail(summary = {}, detail = null) {
  return detail ? { ...summary, ...detail, id: summary.id || detail.id } : summary;
}

function getIndexedDb(indexedDbOverride) {
  if (indexedDbOverride) return indexedDbOverride;
  return typeof indexedDB !== "undefined" ? indexedDB : null;
}

function openHistoryDb(indexedDbOverride) {
  const idb = getIndexedDb(indexedDbOverride);
  if (!idb) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("Unable to open typing history storage."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTEMPT_STORE)) {
        const store = db.createObjectStore(ATTEMPT_STORE, { keyPath: "storageKey" });
        store.createIndex(SCOPE_INDEX, ["scope", "completedAt"], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Typing history transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Typing history transaction was aborted."));
  });
}

export async function saveAttemptDetail(userId, attempt, options = {}) {
  if (!attempt?.id) return false;
  const db = await openHistoryDb(options.indexedDB);
  if (!db) return false;
  try {
    const transaction = db.transaction(ATTEMPT_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(ATTEMPT_STORE).put(buildAttemptDetail(attempt, userId));
    await done;
    return true;
  } finally {
    db.close();
  }
}

export async function saveAttemptDetails(userId, attempts = [], options = {}) {
  const valid = array(attempts).filter((attempt) => attempt?.id);
  if (!valid.length) return 0;
  const db = await openHistoryDb(options.indexedDB);
  if (!db) return 0;
  try {
    const transaction = db.transaction(ATTEMPT_STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(ATTEMPT_STORE);
    valid.forEach((attempt) => store.put(buildAttemptDetail(attempt, userId)));
    await done;
    return valid.length;
  } finally {
    db.close();
  }
}

export async function getAttemptDetails(userId, attemptIds = [], options = {}) {
  const ids = [...new Set(array(attemptIds).filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const db = await openHistoryDb(options.indexedDB);
  if (!db) return new Map();
  try {
    const scope = getHistoryScope(userId);
    const transaction = db.transaction(ATTEMPT_STORE, "readonly");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(ATTEMPT_STORE);
    const pairs = await Promise.all(ids.map((id) => new Promise((resolve) => {
      const request = store.get(detailKey(scope, id));
      request.onsuccess = () => resolve([id, request.result || null]);
      request.onerror = () => resolve([id, null]);
    })));
    await done;
    return new Map(pairs.filter(([, value]) => value));
  } finally {
    db.close();
  }
}

async function getScopeRecords(userId, options = {}) {
  const db = await openHistoryDb(options.indexedDB);
  if (!db) return [];
  try {
    const scope = getHistoryScope(userId);
    const transaction = db.transaction(ATTEMPT_STORE, "readonly");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(ATTEMPT_STORE);
    const records = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result || []).filter((item) => item.scope === scope));
      request.onerror = () => reject(request.error);
    });
    await done;
    return records.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
  } finally {
    db.close();
  }
}

export async function exportAttemptDetails(userId, options = {}) {
  return getScopeRecords(userId, options);
}

export async function getHistoryStats(userId, options = {}) {
  const records = await getScopeRecords(userId, options);
  return {
    detailCount: records.length,
    detailBytes: records.reduce((sum, record) => sum + Math.max(0, number(record.approxBytes)), 0),
    oldestCompletedAt: records.at(-1)?.completedAt || null,
    newestCompletedAt: records[0]?.completedAt || null,
  };
}

export async function pruneAttemptDetails(userId, {
  keep = RECENT_DETAIL_LIMIT,
  protectedIds = [],
  indexedDB: indexedDbOverride,
} = {}) {
  const records = await getScopeRecords(userId, { indexedDB: indexedDbOverride });
  const protectedSet = new Set(array(protectedIds).map(String));
  const keepSet = new Set(records.slice(0, Math.max(0, keep)).map((record) => String(record.id)));
  protectedSet.forEach((id) => keepSet.add(id));
  const removable = records.filter((record) => !keepSet.has(String(record.id)));
  if (!removable.length) return { removed: 0, remaining: records.length };

  const db = await openHistoryDb(indexedDbOverride);
  if (!db) return { removed: 0, remaining: records.length };
  try {
    const transaction = db.transaction(ATTEMPT_STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(ATTEMPT_STORE);
    removable.forEach((record) => store.delete(record.storageKey));
    await done;
    return { removed: removable.length, remaining: records.length - removable.length };
  } finally {
    db.close();
  }
}

export async function clearAttemptDetails(userId, options = {}) {
  const records = await getScopeRecords(userId, options);
  if (!records.length) return 0;
  const db = await openHistoryDb(options.indexedDB);
  if (!db) return 0;
  try {
    const transaction = db.transaction(ATTEMPT_STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(ATTEMPT_STORE);
    records.forEach((record) => store.delete(record.storageKey));
    await done;
    return records.length;
  } finally {
    db.close();
  }
}

export async function getStorageEstimate(userId, localData, options = {}) {
  const history = await getHistoryStats(userId, options);
  const localBytes = estimateBytes(localData);
  let quota = null;
  let usage = null;
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      quota = Number.isFinite(estimate.quota) ? estimate.quota : null;
      usage = Number.isFinite(estimate.usage) ? estimate.usage : null;
    }
  } catch {
    // Browser quota estimates are optional.
  }
  const knownBytes = localBytes + history.detailBytes;
  return {
    ...history,
    localBytes,
    knownBytes,
    usage,
    quota,
    usageRatio: quota && usage != null ? usage / quota : null,
    warning: Boolean(quota && usage != null && usage / quota >= 0.8),
  };
}
