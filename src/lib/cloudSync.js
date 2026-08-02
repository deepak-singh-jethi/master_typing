import { validateImportedData } from "./storage.js";
import { getSupabaseClient } from "./supabase.js";
import { getAttemptDetails, mergeAttemptDetail } from "./historyStore.js";

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const array = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

function toDbBackspace(value) {
  return value === "errors-only" ? "errors_only" : value;
}

function fromDbBackspace(value) {
  return value === "errors_only" ? "errors-only" : value;
}

function toDbMasteryStatus(value) {
  return value === "review-due" ? "review_due" : value === "placement-credit" ? "placement_credit" : value;
}

function fromDbMasteryStatus(value) {
  return value === "review_due" ? "review-due" : value === "placement_credit" ? "placement-credit" : value;
}

function latestIso(...values) {
  return values.filter(Boolean).sort().at(-1) || null;
}

function earliestIso(...values) {
  return values.filter(Boolean).sort().at(0) || null;
}

function weightedAverage(firstAverage, firstCount, secondAverage, secondCount) {
  const total = number(firstCount) + number(secondCount);
  if (!total) return 0;
  return ((number(firstAverage) * number(firstCount)) + (number(secondAverage) * number(secondCount))) / total;
}

function reconcileDistinctAttemptProgress(baseProgress = {}, localProgress = {}, localAttempts = [], attemptIds = []) {
  const requestedIds = new Set(array(attemptIds).map(String));
  const distinctAttempts = array(localAttempts).filter((attempt) => attempt?.id && requestedIds.has(String(attempt.id)));
  if (!distinctAttempts.length) return object(baseProgress);

  const addedCount = distinctAttempts.length;
  const localCount = number(localProgress.totalSessions);
  const localBaseCount = Math.max(0, localCount - addedCount);
  const baseCount = number(baseProgress.totalSessions);
  const useLocalBase = localBaseCount > baseCount;
  const foundationCount = useLocalBase ? localBaseCount : baseCount;
  const sum = (field) => distinctAttempts.reduce((total, attempt) => total + number(attempt[field]), 0);
  const reconcileTotal = (field, attemptField) => {
    const localBaseValue = Math.max(0, number(localProgress[field]) - sum(attemptField));
    return Math.max(number(baseProgress[field]), localBaseValue) + sum(attemptField);
  };
  const reconcileAverage = (field, attemptField) => {
    const addedSum = sum(attemptField);
    const localBaseSum = Math.max(0, (number(localProgress[field]) * localCount) - addedSum);
    const foundationSum = useLocalBase
      ? localBaseSum
      : number(baseProgress[field]) * baseCount;
    return foundationCount + addedCount
      ? (foundationSum + addedSum) / (foundationCount + addedCount)
      : 0;
  };

  return {
    ...object(baseProgress),
    totalPracticeSeconds: reconcileTotal("totalPracticeSeconds", "durationSeconds"),
    totalSessions: foundationCount + addedCount,
    totalCharacters: reconcileTotal("totalCharacters", "charactersTyped"),
    totalCorrectCharacters: reconcileTotal("totalCorrectCharacters", "correctCharacters"),
    bestWpm: Math.max(number(baseProgress.bestWpm), number(localProgress.bestWpm), ...distinctAttempts.map((attempt) => number(attempt.netWpm))),
    averageWpm: reconcileAverage("averageWpm", "netWpm"),
    averageAccuracy: reconcileAverage("averageAccuracy", "accuracy"),
    averageConsistency: reconcileAverage("averageConsistency", "consistency"),
    currentStreak: Math.max(number(baseProgress.currentStreak), number(localProgress.currentStreak)),
    longestStreak: Math.max(number(baseProgress.longestStreak), number(localProgress.longestStreak)),
    lastPracticeDate: latestIso(baseProgress.lastPracticeDate, localProgress.lastPracticeDate),
  };
}

export function hasMeaningfulLocalProgress(data) {
  return Boolean(
    data?.onboarding?.completed
    || number(data?.progress?.totalSessions) > 0
    || array(data?.progress?.completedLessons).length > 0,
  );
}

export function toProfileRow(userId, data) {
  return {
    user_id: userId,
    display_name: data.profile?.name || "Learner",
    onboarding_completed: Boolean(data.onboarding?.completed),
    skill_stage: data.profile?.experience === "hunt-and-peck"
      ? "hunt_and_peck"
      : data.profile?.experience === "touch-typist"
        ? "touch_typist"
        : data.profile?.experience === "advanced"
          ? "advanced"
          : "beginner",
    typing_goal: data.profile?.primaryGoal === "work" ? "practical" : data.profile?.primaryGoal || "accuracy",
    daily_goal_minutes: number(data.settings?.dailyGoalMinutes, 15),
  };
}

export function toSettingsRow(userId, data) {
  return {
    user_id: userId,
    theme: data.settings?.theme || "system",
    keyboard_visible: Boolean(data.settings?.showKeyboard),
    backspace_mode: toDbBackspace(data.settings?.backspaceMode || "allowed"),
    sound_enabled: Boolean(data.settings?.soundEnabled),
    text_size: data.settings?.textSize || "medium",
    preferences: {
      showLiveWpm: data.settings?.showLiveWpm,
      showLiveAccuracy: data.settings?.showLiveAccuracy,
      reduceMotion: data.settings?.reduceMotion,
      autoPause: data.settings?.autoPause,
      caretStyle: data.settings?.caretStyle,
    },
  };
}

function progressRow(userId, data) {
  return {
    user_id: userId,
    data_version: number(data.version, 8),
    active_course_id: data.progress?.activeCourseId || "touch-typing-path",
    active_lesson_id: data.progress?.activeLessonId || "home-f-j",
    completed_lessons: array(data.progress?.completedLessons),
    total_practice_seconds: number(data.progress?.totalPracticeSeconds),
    total_sessions: number(data.progress?.totalSessions),
    total_characters: number(data.progress?.totalCharacters),
    total_correct_characters: number(data.progress?.totalCorrectCharacters),
    best_wpm: number(data.progress?.bestWpm),
    average_wpm: number(data.progress?.averageWpm),
    average_accuracy: number(data.progress?.averageAccuracy),
    average_consistency: number(data.progress?.averageConsistency),
    current_streak: number(data.progress?.currentStreak),
    longest_streak: number(data.progress?.longestStreak),
    last_practice_date: data.progress?.lastPracticeDate || null,
    onboarding: object(data.onboarding),
    adaptive: object(data.adaptive),
    personal_bests: object(data.personalBests),
    last_practice_config: object(data.lastPracticeConfig),
    saved_custom_texts: array(data.savedCustomTexts).slice(0, 20),
    practice_content_history: array(data.statistics?.practiceContentHistory).slice(0, 20),
  };
}

function lessonRows(userId, mastery = {}) {
  return Object.entries(object(mastery)).map(([lessonId, item]) => ({
    user_id: userId,
    lesson_id: lessonId,
    status: toDbMasteryStatus(item.state || "learning"),
    mastery_score: number(item.masteryScore),
    passed_exercises: [...new Set(array(item.passedExerciseIds ?? item.passedExerciseIndexes).map(String).filter(Boolean))],
    attempt_count: number(item.attemptCount, number(item.attempts)),
    best_accuracy: number(item.bestAccuracy),
    best_wpm: number(item.bestWpm),
    last_practiced_at: item.lastPractisedAt || item.lastPracticedAt || null,
    mastered_at: item.masteredAt || null,
    review_due_at: item.reviewDueAt || item.dueAt || null,
    review_interval_days: number(item.reviewIntervalDays),
    review_count: number(item.reviewCount),
    metadata: item,
  }));
}

export function toSessionPayload(item, userId = undefined) {
  const row = {
    user_id: userId,
    client_session_id: String(item.id),
    mode: item.type || "practice",
    purpose: item.practicePurpose || item.purpose || null,
    content_type: item.contentType || null,
    lesson_id: item.lessonId || null,
    duration_seconds: number(item.durationSeconds),
    active_duration_seconds: number(item.activeDurationSeconds, number(item.durationSeconds)),
    net_wpm: number(item.netWpm),
    gross_wpm: number(item.rawWpm),
    keystroke_accuracy: number(item.keystrokeAccuracy, number(item.accuracy)),
    final_text_accuracy: number(item.finalTextAccuracy, number(item.accuracy)),
    consistency: number(item.consistency),
    burst_wpm: number(item.burstWpm),
    correction_rate: number(item.correctionRate),
    typed_characters: number(item.charactersTyped),
    correct_characters: number(item.correctCharacters),
    error_count: number(item.errors, number(item.errorCount)),
    corrected_errors: number(item.correctedErrors),
    valid_benchmark: Boolean(item.benchmarkValid ?? item.validBenchmark ?? item.validSession),
    personal_best_eligible: Boolean(item.personalBestEligible),
    focus_keys: array(item.focusKeys),
    difficult_bigrams: array(item.difficultBigrams)
      .map((entry) => typeof entry === "string" ? entry : entry?.key)
      .filter(Boolean),
    mistake_words: array(item.mistakeWords)
      .map((word) => typeof word === "string" ? word : word?.expected)
      .filter(Boolean),
    metadata: {
      testId: item.testId,
      practiceMode: item.practiceMode,
      modeId: item.modeId,
      goalType: item.goalType,
      wordCount: item.wordCount,
      plannedDurationSeconds: item.plannedDurationSeconds,
      exerciseId: item.exerciseId,
      exerciseTitle: item.exerciseTitle,
      practicePurpose: item.practicePurpose,
      accuracy: item.accuracy,
      isPersonalBest: item.isPersonalBest,
      recipeVersion: item.recipeVersion,
      curriculumVersion: item.curriculumVersion,
      contentVersion: item.contentVersion,
      guidedStage: item.guidedStage,
      masteryRuleVersion: item.masteryRuleVersion,
      unseenTransfer: item.unseenTransfer,
      reviewScope: item.reviewScope,
      checkpointModuleId: item.checkpointModuleId,
      proficiencyStandardVersion: item.proficiencyStandardVersion,
      proficiencyAssessmentMode: item.proficiencyAssessmentMode,
      proficiencyEligible: item.proficiencyEligible,
      proficiencyLevelId: item.proficiencyLevelId,
      proficiencyLevelLabel: item.proficiencyLevelLabel,
      estimatedProficiencyLevelId: item.estimatedProficiencyLevelId,
      accuracyBandId: item.accuracyBandId,
      paceBandId: item.paceBandId,
      remediationVersion: item.remediationVersion,
      remediationChainId: item.remediationChainId,
      remediationStage: item.remediationStage,
      remediationSourceType: item.remediationSourceType,
      remediationSourceId: item.remediationSourceId,
      remediationFreshText: item.remediationFreshText,
      benchmarkValid: item.benchmarkValid,
      validSession: item.validSession,
      category: item.category,
      difficulty: item.difficulty,
      progressiveFeatures: item.progressiveFeatures,
      punctuation: item.punctuation,
      capitals: item.capitals,
      numbers: item.numbers,
      documentStyle: item.documentStyle,
      generatedFocusDensity: item.generatedFocusDensity,
      generatedUniqueRatio: item.generatedUniqueRatio,
      generatedRepeatRate: item.generatedRepeatRate,
      generatedMotorBand: item.generatedMotorBand,
      generatedMotorScore: item.generatedMotorScore,
      generatedFeatureCounts: item.generatedFeatureCounts,
    },
    started_at: item.startedAt || null,
    completed_at: item.completedAt || new Date().toISOString(),
  };
  if (!userId) delete row.user_id;
  return row;
}

function wordErrorPayload(mistakeWords = []) {
  const counts = {};
  array(mistakeWords).forEach((item) => {
    const word = String(typeof item === "string" ? item : item?.expected || "").trim().toLowerCase();
    if (word) counts[word] = (counts[word] || 0) + 1;
  });
  return counts;
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.round(number(value)));
}

export function normaliseTimingStatsForCloud(stats = {}) {
  return Object.fromEntries(
    Object.entries(object(stats)).map(([key, rawStat]) => {
      const stat = object(rawStat);
      const confusions = Object.fromEntries(
        Object.entries(object(stat.confusions))
          .map(([actual, count]) => [actual, nonNegativeInteger(count)])
          .filter(([, count]) => count > 0),
      );

      return [key, {
        ...stat,
        attempts: nonNegativeInteger(stat.attempts),
        correct: nonNegativeInteger(stat.correct),
        errors: nonNegativeInteger(stat.errors),
        correctedErrors: nonNegativeInteger(stat.correctedErrors),
        timedAttempts: nonNegativeInteger(stat.timedAttempts),
        totalLatencyMs: nonNegativeInteger(stat.totalLatencyMs),
        fastestMs: stat.fastestMs == null ? null : nonNegativeInteger(stat.fastestMs),
        slowestMs: stat.slowestMs == null ? null : nonNegativeInteger(stat.slowestMs),
        confusions,
      }];
    }),
  );
}

async function syncOneSession(supabase, attempt) {
  const payload = {
    ...toSessionPayload(attempt),
    activity_date: attempt.activityDate || String(attempt.completedAt || new Date().toISOString()).slice(0, 10),
    review_attempt: Boolean(attempt.reviewAttempt),
  };
  const { error } = await supabase.rpc("sync_typing_session", {
    p_session: payload,
    p_key_stats: normaliseTimingStatsForCloud(attempt.keyStats),
    p_bigram_stats: normaliseTimingStatsForCloud(attempt.bigramStats),
    p_word_errors: wordErrorPayload(attempt.mistakeWords),
  });
  if (error) throw error;
}

export async function pushCloudData(userId, data, options = {}) {
  const supabase = await getSupabaseClient();
  if (!supabase || !userId) return { syncedSessionIds: [] };

  const deviceId = options.deviceId || "browser";
  const operations = [
    supabase.from("profiles").upsert(toProfileRow(userId, data)),
    supabase.from("user_settings").upsert(toSettingsRow(userId, data)),
    supabase.from("user_progress").upsert(progressRow(userId, data)),
    supabase.from("sync_state").upsert({
      user_id: userId,
      device_id: deviceId,
      client_data_version: number(data.version, 9),
      local_revision: number(options.localRevision, Date.now()),
      server_revision: number(options.localRevision, Date.now()),
      last_synced_at: new Date().toISOString(),
      metadata: { client: "typing-master-web" },
    }),
  ];

  const mastery = lessonRows(userId, data.progress?.lessonMastery);
  if (mastery.length) operations.push(supabase.from("lesson_mastery").upsert(mastery));

  const results = await Promise.all(operations);
  const failure = results.find((result) => result.error);
  if (failure?.error) throw failure.error;

  const requestedIds = new Set(array(options.sessionIds).map(String));
  const summaries = requestedIds.size
    ? array(data.attempts).filter((item) => requestedIds.has(String(item.id)))
    : [];
  const detailMap = await getAttemptDetails(userId, summaries.map((item) => String(item.id)));
  const attempts = summaries.map((summary) => mergeAttemptDetail(summary, detailMap.get(String(summary.id))));

  for (const attempt of attempts) {
    await syncOneSession(supabase, attempt);
  }

  return { syncedSessionIds: attempts.map((item) => String(item.id)) };
}

function cloudAttempt(row) {
  return {
    id: row.client_session_id,
    type: row.mode,
    practicePurpose: row.purpose,
    contentType: row.content_type,
    lessonId: row.lesson_id,
    durationSeconds: row.duration_seconds,
    activeDurationSeconds: row.active_duration_seconds,
    netWpm: number(row.net_wpm),
    rawWpm: number(row.gross_wpm),
    accuracy: number(row.final_text_accuracy),
    keystrokeAccuracy: number(row.keystroke_accuracy),
    finalTextAccuracy: number(row.final_text_accuracy),
    consistency: number(row.consistency),
    burstWpm: number(row.burst_wpm),
    correctionRate: number(row.correction_rate),
    charactersTyped: number(row.typed_characters),
    correctCharacters: number(row.correct_characters),
    errors: number(row.error_count),
    correctedErrors: number(row.corrected_errors),
    validBenchmark: Boolean(row.valid_benchmark),
    benchmarkValid: row.metadata?.benchmarkValid ?? Boolean(row.valid_benchmark),
    validSession: row.metadata?.validSession ?? true,
    personalBestEligible: Boolean(row.personal_best_eligible),
    focusKeys: array(row.focus_keys),
    difficultBigrams: array(row.difficult_bigrams),
    mistakeWords: array(row.mistake_words),
    completedAt: row.completed_at,
    ...object(row.metadata),
  };
}

function masteryRank(state) {
  return {
    locked: 0,
    learning: 1,
    practising: 2,
    "placement-credit": 3,
    mastered: 4,
    "review-due": 5,
  }[state] ?? 0;
}

function mergeExerciseResult(first = {}, second = {}) {
  const firstResult = object(first);
  const secondResult = object(second);
  const firstFingerprints = array(firstResult.attemptedFingerprints).map(String);
  const secondFingerprints = array(secondResult.attemptedFingerprints).map(String);
  return {
    ...firstResult,
    ...secondResult,
    attempts: Math.max(number(firstResult.attempts), number(secondResult.attempts)),
    passed: Boolean(firstResult.passed || secondResult.passed),
    bestAccuracy: Math.max(number(firstResult.bestAccuracy), number(secondResult.bestAccuracy)),
    bestWpm: Math.max(number(firstResult.bestWpm), number(secondResult.bestWpm)),
    bestFocusAccuracy: Math.max(number(firstResult.bestFocusAccuracy), number(secondResult.bestFocusAccuracy)),
    unseenPassed: Boolean(firstResult.unseenPassed || secondResult.unseenPassed),
    cumulativeReviewPassed: Boolean(firstResult.cumulativeReviewPassed || secondResult.cumulativeReviewPassed),
    masteryRuleVersion: Math.max(number(firstResult.masteryRuleVersion, 1), number(secondResult.masteryRuleVersion, 1)),
    contentVersion: Math.max(number(firstResult.contentVersion), number(secondResult.contentVersion)),
    attemptedFingerprints: [...new Set([...firstFingerprints, ...secondFingerprints])].slice(-8),
    lastAttemptAt: latestIso(firstResult.lastAttemptAt, secondResult.lastAttemptAt),
    lastPassedAt: latestIso(firstResult.lastPassedAt, secondResult.lastPassedAt),
  };
}

function mergeExerciseResultMaps(first = {}, second = {}) {
  const ids = new Set([...Object.keys(object(first)), ...Object.keys(object(second))]);
  return Object.fromEntries([...ids].map((id) => [id, mergeExerciseResult(first[id], second[id])]));
}

function latestMasteryRecord(first = {}, second = {}) {
  const firstReviews = number(first.reviewCount);
  const secondReviews = number(second.reviewCount);
  if (firstReviews !== secondReviews) return secondReviews > firstReviews ? second : first;

  const firstTime = Date.parse(first.lastPractisedAt || first.lastPracticedAt || "");
  const secondTime = Date.parse(second.lastPractisedAt || second.lastPracticedAt || "");
  if (Number.isFinite(firstTime) || Number.isFinite(secondTime)) {
    if (!Number.isFinite(firstTime)) return second;
    if (!Number.isFinite(secondTime)) return first;
    if (firstTime !== secondTime) return secondTime > firstTime ? second : first;
  }

  return masteryRank(second.state) >= masteryRank(first.state) ? second : first;
}

function mergeRecentAttempts(first = [], second = []) {
  const attempts = new Map();
  [...array(first), ...array(second)].forEach((item) => {
    if (!item) return;
    const key = String(item.id || `${item.exerciseId || "exercise"}:${item.completedAt || attempts.size}`);
    const existing = attempts.get(key);
    attempts.set(key, existing ? { ...existing, ...item } : item);
  });
  return [...attempts.values()]
    .sort((a, b) => String(a.completedAt || "").localeCompare(String(b.completedAt || "")))
    .slice(-9);
}

function mergeMastery(first = {}, second = {}) {
  const firstState = first.state || "learning";
  const preferred = latestMasteryRecord(first, second);
  const exerciseResults = mergeExerciseResultMaps(first.exerciseResults, second.exerciseResults);
  const firstReviewCount = number(first.reviewCount);
  const secondReviewCount = number(second.reviewCount);
  const reviewExerciseResults = firstReviewCount === secondReviewCount
    ? mergeExerciseResultMaps(first.reviewExerciseResults, second.reviewExerciseResults)
    : object(preferred.reviewExerciseResults);
  const passedExerciseIds = [...new Set([
    ...array(first.passedExerciseIds),
    ...array(second.passedExerciseIds),
    ...Object.entries(exerciseResults).filter(([, item]) => item.passed).map(([id]) => id),
  ])];
  return {
    ...first,
    ...second,
    ...preferred,
    state: preferred.state || firstState,
    masteryScore: Math.max(number(first.masteryScore), number(second.masteryScore)),
    passedExerciseIndexes: [...new Set([
      ...array(first.passedExerciseIndexes),
      ...array(second.passedExerciseIndexes),
    ])],
    passedExerciseIds,
    attemptCount: Math.max(number(first.attemptCount, number(first.attempts)), number(second.attemptCount, number(second.attempts))),
    attempts: Math.max(number(first.attempts, number(first.attemptCount)), number(second.attempts, number(second.attemptCount))),
    successfulAttempts: Math.max(number(first.successfulAttempts), number(second.successfulAttempts), passedExerciseIds.length),
    bestAccuracy: Math.max(number(first.bestAccuracy), number(second.bestAccuracy)),
    bestWpm: Math.max(number(first.bestWpm), number(second.bestWpm)),
    lastPractisedAt: latestIso(first.lastPractisedAt, first.lastPracticedAt, second.lastPractisedAt, second.lastPracticedAt),
    lastPassedAt: latestIso(first.lastPassedAt, second.lastPassedAt),
    masteredAt: earliestIso(first.masteredAt, second.masteredAt),
    dueAt: preferred.dueAt || preferred.reviewDueAt || latestIso(first.dueAt, first.reviewDueAt, second.dueAt, second.reviewDueAt),
    reviewDueAt: preferred.reviewDueAt || preferred.dueAt || latestIso(first.reviewDueAt, first.dueAt, second.reviewDueAt, second.dueAt),
    reviewIntervalDays: number(preferred.reviewIntervalDays, Math.max(number(first.reviewIntervalDays), number(second.reviewIntervalDays))),
    reviewCount: Math.max(number(first.reviewCount), number(second.reviewCount)),
    exerciseResults,
    reviewExerciseResults,
    reviewCycleStartedAt: preferred.reviewCycleStartedAt ?? null,
    recentAttempts: mergeRecentAttempts(first.recentAttempts, second.recentAttempts),
  };
}

function mergeMasteryMaps(first = {}, second = {}) {
  const ids = new Set([...Object.keys(object(first)), ...Object.keys(object(second))]);
  return Object.fromEntries([...ids].map((id) => [id, mergeMastery(first[id], second[id])]));
}

function mergeAttempts(first = [], second = []) {
  const map = new Map();
  [...array(first), ...array(second)].forEach((item) => {
    if (!item?.id) return;
    const existing = map.get(String(item.id));
    map.set(String(item.id), existing ? { ...existing, ...item, typedText: existing.typedText ?? item.typedText } : item);
  });
  return [...map.values()]
    .sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")))
    .slice(0, 1000);
}

function maxTimingStats(local = {}, cloud = {}) {
  const output = {};
  const keys = new Set([...Object.keys(object(local)), ...Object.keys(object(cloud))]);
  keys.forEach((key) => {
    const a = object(local[key]);
    const b = object(cloud[key]);
    const confusions = {};
    const confusionKeys = new Set([...Object.keys(object(a.confusions)), ...Object.keys(object(b.confusions))]);
    confusionKeys.forEach((actual) => {
      confusions[actual] = Math.max(number(a.confusions?.[actual]), number(b.confusions?.[actual]));
    });
    const fastest = [a.fastestMs, b.fastestMs].map(Number).filter(Number.isFinite);
    output[key] = {
      ...a,
      ...b,
      attempts: Math.max(number(a.attempts), number(b.attempts)),
      correct: Math.max(number(a.correct), number(b.correct)),
      errors: Math.max(number(a.errors), number(b.errors)),
      correctedErrors: Math.max(number(a.correctedErrors), number(b.correctedErrors)),
      timedAttempts: Math.max(number(a.timedAttempts), number(b.timedAttempts)),
      totalLatencyMs: Math.max(number(a.totalLatencyMs), number(b.totalLatencyMs)),
      fastestMs: fastest.length ? Math.min(...fastest) : null,
      slowestMs: Math.max(number(a.slowestMs), number(b.slowestMs)),
      confusions,
      lastPractisedAt: latestIso(a.lastPractisedAt, b.lastPractisedAt),
    };
  });
  return output;
}

function addTimingStats(first = {}, second = {}) {
  const output = {};
  const keys = new Set([...Object.keys(object(first)), ...Object.keys(object(second))]);
  keys.forEach((key) => {
    const a = object(first[key]);
    const b = object(second[key]);
    const confusions = { ...object(a.confusions) };
    Object.entries(object(b.confusions)).forEach(([actual, count]) => {
      confusions[actual] = number(confusions[actual]) + number(count);
    });
    const fastest = [a.fastestMs, b.fastestMs].map(Number).filter(Number.isFinite);
    output[key] = {
      ...a,
      ...b,
      attempts: number(a.attempts) + number(b.attempts),
      correct: number(a.correct) + number(b.correct),
      errors: number(a.errors) + number(b.errors),
      correctedErrors: number(a.correctedErrors) + number(b.correctedErrors),
      timedAttempts: number(a.timedAttempts) + number(b.timedAttempts),
      totalLatencyMs: number(a.totalLatencyMs) + number(b.totalLatencyMs),
      fastestMs: fastest.length ? Math.min(...fastest) : null,
      slowestMs: Math.max(number(a.slowestMs), number(b.slowestMs)),
      confusions,
      lastPractisedAt: latestIso(a.lastPractisedAt, b.lastPractisedAt),
    };
  });
  return output;
}

function maxWordStats(local = {}, cloud = {}) {
  const output = {};
  const keys = new Set([...Object.keys(object(local)), ...Object.keys(object(cloud))]);
  keys.forEach((key) => {
    const a = object(local[key]);
    const b = object(cloud[key]);
    output[key] = {
      ...a,
      ...b,
      errors: Math.max(number(a.errors), number(b.errors)),
      lastPractisedAt: latestIso(a.lastPractisedAt, b.lastPractisedAt),
    };
  });
  return output;
}

function addWordStats(first = {}, second = {}) {
  const output = {};
  const keys = new Set([...Object.keys(object(first)), ...Object.keys(object(second))]);
  keys.forEach((key) => {
    const a = object(first[key]);
    const b = object(second[key]);
    output[key] = {
      ...a,
      ...b,
      errors: number(a.errors) + number(b.errors),
      lastPractisedAt: latestIso(a.lastPractisedAt, b.lastPractisedAt),
    };
  });
  return output;
}

function mergeDailyMax(local = {}, cloud = {}) {
  const output = {};
  const keys = new Set([...Object.keys(object(local)), ...Object.keys(object(cloud))]);
  keys.forEach((key) => {
    const a = object(local[key]);
    const b = object(cloud[key]);
    output[key] = {
      seconds: Math.max(number(a.seconds), number(b.seconds)),
      sessions: Math.max(number(a.sessions), number(b.sessions)),
      characters: Math.max(number(a.characters), number(b.characters)),
      bestWpm: Math.max(number(a.bestWpm), number(b.bestWpm)),
      averageAccuracy: number(b.sessions) >= number(a.sessions) ? number(b.averageAccuracy) : number(a.averageAccuracy),
    };
  });
  return output;
}

function mergeDailyAdd(first = {}, second = {}) {
  const output = {};
  const keys = new Set([...Object.keys(object(first)), ...Object.keys(object(second))]);
  keys.forEach((key) => {
    const a = object(first[key]);
    const b = object(second[key]);
    output[key] = {
      seconds: number(a.seconds) + number(b.seconds),
      sessions: number(a.sessions) + number(b.sessions),
      characters: number(a.characters) + number(b.characters),
      bestWpm: Math.max(number(a.bestWpm), number(b.bestWpm)),
      averageAccuracy: weightedAverage(a.averageAccuracy, a.sessions, b.averageAccuracy, b.sessions),
    };
  });
  return output;
}

function cloudStatistics(dailyRows = [], skillRows = []) {
  const dailyActivity = {};
  array(dailyRows).forEach((row) => {
    dailyActivity[row.activity_date] = {
      seconds: number(row.practice_seconds),
      sessions: number(row.sessions_count),
      characters: number(row.characters_typed),
      bestWpm: number(row.best_wpm),
      averageAccuracy: number(row.average_accuracy),
    };
  });

  const keyStats = {};
  const bigramStats = {};
  const wordStats = {};
  array(skillRows).forEach((row) => {
    if (row.skill_type === "word") {
      wordStats[row.skill_key] = {
        errors: number(row.errors),
        lastPractisedAt: row.last_seen_at,
      };
      return;
    }
    if (row.skill_type === "confusion") {
      const [expected, actual] = String(row.skill_key).split("→");
      if (!expected || !actual) return;
      const base = keyStats[expected] ?? { attempts: 0, errors: 0, confusions: {} };
      base.confusions = { ...object(base.confusions), [actual]: number(row.errors) };
      keyStats[expected] = base;
      return;
    }
    const target = row.skill_type === "bigram" ? bigramStats : keyStats;
    target[row.skill_key] = {
      attempts: number(row.attempts),
      correct: Math.max(0, number(row.attempts) - number(row.errors)),
      errors: number(row.errors),
      correctedErrors: number(row.corrected_errors),
      timedAttempts: number(row.attempts),
      totalLatencyMs: number(row.total_latency_ms),
      confusions: object(target[row.skill_key]?.confusions),
      lastPractisedAt: row.last_seen_at,
    };
  });
  return { dailyActivity, keyStats, bigramStats, wordStats };
}

export function mergeCloudIntoLocal(localData, cloud, options = {}) {
  if (!cloud?.progress) return validateImportedData(localData);
  const profile = cloud.profile;
  const settings = cloud.settings;
  const progress = cloud.progress;
  const cloudAttempts = array(cloud.sessions).map(cloudAttempt);
  const attempts = mergeAttempts(localData.attempts, cloudAttempts);
  const cloudMastery = Object.fromEntries(array(cloud.mastery).map((row) => [row.lesson_id, {
    ...object(row.metadata),
    state: fromDbMasteryStatus(row.status),
    masteryScore: number(row.mastery_score),
    passedExerciseIds: array(row.passed_exercises).map(String),
    attemptCount: number(row.attempt_count),
    bestAccuracy: number(row.best_accuracy),
    bestWpm: number(row.best_wpm),
    lastPractisedAt: row.last_practiced_at,
    masteredAt: row.mastered_at,
    reviewDueAt: row.review_due_at,
    dueAt: row.review_due_at,
    reviewIntervalDays: number(row.review_interval_days),
    reviewCount: number(row.review_count),
  }]));
  const mastery = mergeMasteryMaps(localData.progress?.lessonMastery, cloudMastery);
  const cloudStats = cloudStatistics(cloud.dailyActivity, cloud.skills);
  const localCount = number(localData.progress?.totalSessions);
  const cloudCount = number(progress.total_sessions);
  const cloudIsNewer = cloudCount >= localCount;
  const cloudSessionIds = new Set(array(cloud.sessions).map((row) => String(row.client_session_id)));
  const additiveSessionIds = array(options.pendingSessionIds)
    .map(String)
    .filter((id) => !cloudSessionIds.has(id));
  const cloudProgress = {
    totalPracticeSeconds: number(progress.total_practice_seconds),
    totalSessions: cloudCount,
    totalCharacters: number(progress.total_characters),
    totalCorrectCharacters: number(progress.total_correct_characters),
    bestWpm: number(progress.best_wpm),
    averageWpm: number(progress.average_wpm),
    averageAccuracy: number(progress.average_accuracy),
    averageConsistency: number(progress.average_consistency),
    currentStreak: number(progress.current_streak),
    longestStreak: number(progress.longest_streak),
    lastPracticeDate: progress.last_practice_date,
  };
  const reconciledProgress = reconcileDistinctAttemptProgress(
    cloudProgress,
    localData.progress,
    localData.attempts,
    additiveSessionIds,
  );

  return validateImportedData({
    ...localData,
    version: Math.max(number(localData.version), number(progress.data_version)),
    profile: {
      ...localData.profile,
      name: profile?.display_name || localData.profile?.name,
      joinedAt: profile?.created_at || localData.profile?.joinedAt,
      experience: profile?.skill_stage === "hunt_and_peck" ? "hunt-and-peck" : profile?.skill_stage === "touch_typist" ? "touch-typist" : profile?.skill_stage || localData.profile?.experience,
      primaryGoal: profile?.typing_goal === "practical" ? "work" : profile?.typing_goal || localData.profile?.primaryGoal,
    },
    settings: {
      ...localData.settings,
      theme: settings?.theme || localData.settings?.theme,
      dailyGoalMinutes: profile?.daily_goal_minutes || localData.settings?.dailyGoalMinutes,
      showKeyboard: settings?.keyboard_visible ?? localData.settings?.showKeyboard,
      backspaceMode: fromDbBackspace(settings?.backspace_mode || localData.settings?.backspaceMode),
      soundEnabled: settings?.sound_enabled ?? localData.settings?.soundEnabled,
      textSize: settings?.text_size || localData.settings?.textSize,
      ...object(settings?.preferences),
    },
    onboarding: cloudIsNewer ? object(progress.onboarding) : localData.onboarding,
    adaptive: cloudIsNewer ? object(progress.adaptive) : localData.adaptive,
    progress: {
      ...localData.progress,
      activeCourseId: cloudIsNewer ? progress.active_course_id : localData.progress?.activeCourseId,
      activeLessonId: cloudIsNewer ? progress.active_lesson_id : localData.progress?.activeLessonId,
      completedLessons: [...new Set([...array(localData.progress?.completedLessons), ...array(progress.completed_lessons)])],
      lessonMastery: mastery,
      totalPracticeSeconds: additiveSessionIds.length ? reconciledProgress.totalPracticeSeconds : Math.max(number(localData.progress?.totalPracticeSeconds), number(progress.total_practice_seconds)),
      totalSessions: additiveSessionIds.length ? reconciledProgress.totalSessions : Math.max(localCount, cloudCount),
      totalCharacters: additiveSessionIds.length ? reconciledProgress.totalCharacters : Math.max(number(localData.progress?.totalCharacters), number(progress.total_characters)),
      totalCorrectCharacters: additiveSessionIds.length ? reconciledProgress.totalCorrectCharacters : Math.max(number(localData.progress?.totalCorrectCharacters), number(progress.total_correct_characters)),
      bestWpm: additiveSessionIds.length ? reconciledProgress.bestWpm : Math.max(number(localData.progress?.bestWpm), number(progress.best_wpm)),
      averageWpm: additiveSessionIds.length ? reconciledProgress.averageWpm : cloudIsNewer ? number(progress.average_wpm) : number(localData.progress?.averageWpm),
      averageAccuracy: additiveSessionIds.length ? reconciledProgress.averageAccuracy : cloudIsNewer ? number(progress.average_accuracy) : number(localData.progress?.averageAccuracy),
      averageConsistency: additiveSessionIds.length ? reconciledProgress.averageConsistency : cloudIsNewer ? number(progress.average_consistency) : number(localData.progress?.averageConsistency),
      currentStreak: additiveSessionIds.length ? reconciledProgress.currentStreak : Math.max(number(localData.progress?.currentStreak), number(progress.current_streak)),
      longestStreak: additiveSessionIds.length ? reconciledProgress.longestStreak : Math.max(number(localData.progress?.longestStreak), number(progress.longest_streak)),
      lastPracticeDate: additiveSessionIds.length ? reconciledProgress.lastPracticeDate : latestIso(localData.progress?.lastPracticeDate, progress.last_practice_date),
    },
    personalBests: { ...object(progress.personal_bests), ...object(localData.personalBests) },
    lastPracticeConfig: cloudIsNewer ? object(progress.last_practice_config) : localData.lastPracticeConfig,
    savedCustomTexts: [...array(progress.saved_custom_texts), ...array(localData.savedCustomTexts)]
      .filter((item, index, all) => index === all.findIndex((other) => other?.id === item?.id))
      .slice(0, 20),
    statistics: {
      ...localData.statistics,
      keyStats: maxTimingStats(localData.statistics?.keyStats, cloudStats.keyStats),
      bigramStats: maxTimingStats(localData.statistics?.bigramStats, cloudStats.bigramStats),
      wordStats: maxWordStats(localData.statistics?.wordStats, cloudStats.wordStats),
      dailyActivity: mergeDailyMax(localData.statistics?.dailyActivity, cloudStats.dailyActivity),
      practiceContentHistory: [...array(localData.statistics?.practiceContentHistory), ...array(progress.practice_content_history)]
        .filter((item, index, all) => index === all.findIndex((other) => other?.fingerprint === item?.fingerprint))
        .slice(0, 20),
    },
    attempts,
  });
}

export function mergeAccountLocalData(baseData, latestData, options = {}) {
  const baseCount = number(baseData.progress?.totalSessions);
  const latestCount = number(latestData.progress?.totalSessions);
  const preferLatest = latestCount >= baseCount;
  const preferLatestSnapshot = Boolean(options.preferLatestSnapshot);
  const preferLatestPersonalState = preferLatestSnapshot || preferLatest;
  const reconciledProgress = reconcileDistinctAttemptProgress(
    baseData.progress,
    latestData.progress,
    latestData.attempts,
    options.additiveSessionIds,
  );
  const hasAdditiveSessions = array(options.additiveSessionIds).length > 0;
  return validateImportedData({
    ...baseData,
    profile: preferLatestPersonalState ? latestData.profile : baseData.profile,
    settings: preferLatestPersonalState ? latestData.settings : baseData.settings,
    onboarding: preferLatestPersonalState ? latestData.onboarding : baseData.onboarding,
    adaptive: preferLatestPersonalState ? latestData.adaptive : baseData.adaptive,
    progress: {
      ...baseData.progress,
      activeLessonId: preferLatest ? latestData.progress?.activeLessonId : baseData.progress?.activeLessonId,
      completedLessons: [...new Set([...array(baseData.progress?.completedLessons), ...array(latestData.progress?.completedLessons)])],
      lessonMastery: mergeMasteryMaps(baseData.progress?.lessonMastery, latestData.progress?.lessonMastery),
      totalPracticeSeconds: hasAdditiveSessions ? reconciledProgress.totalPracticeSeconds : Math.max(number(baseData.progress?.totalPracticeSeconds), number(latestData.progress?.totalPracticeSeconds)),
      totalSessions: hasAdditiveSessions ? reconciledProgress.totalSessions : Math.max(baseCount, latestCount),
      totalCharacters: hasAdditiveSessions ? reconciledProgress.totalCharacters : Math.max(number(baseData.progress?.totalCharacters), number(latestData.progress?.totalCharacters)),
      totalCorrectCharacters: hasAdditiveSessions ? reconciledProgress.totalCorrectCharacters : Math.max(number(baseData.progress?.totalCorrectCharacters), number(latestData.progress?.totalCorrectCharacters)),
      bestWpm: hasAdditiveSessions ? reconciledProgress.bestWpm : Math.max(number(baseData.progress?.bestWpm), number(latestData.progress?.bestWpm)),
      averageWpm: hasAdditiveSessions ? reconciledProgress.averageWpm : preferLatest ? number(latestData.progress?.averageWpm) : number(baseData.progress?.averageWpm),
      averageAccuracy: hasAdditiveSessions ? reconciledProgress.averageAccuracy : preferLatest ? number(latestData.progress?.averageAccuracy) : number(baseData.progress?.averageAccuracy),
      averageConsistency: hasAdditiveSessions ? reconciledProgress.averageConsistency : preferLatest ? number(latestData.progress?.averageConsistency) : number(baseData.progress?.averageConsistency),
      currentStreak: hasAdditiveSessions ? reconciledProgress.currentStreak : Math.max(number(baseData.progress?.currentStreak), number(latestData.progress?.currentStreak)),
      longestStreak: hasAdditiveSessions ? reconciledProgress.longestStreak : Math.max(number(baseData.progress?.longestStreak), number(latestData.progress?.longestStreak)),
      lastPracticeDate: hasAdditiveSessions ? reconciledProgress.lastPracticeDate : latestIso(baseData.progress?.lastPracticeDate, latestData.progress?.lastPracticeDate),
    },
    personalBests: { ...object(baseData.personalBests), ...object(latestData.personalBests) },
    lastPracticeConfig: preferLatestPersonalState ? latestData.lastPracticeConfig : baseData.lastPracticeConfig,
    savedCustomTexts: [...array(latestData.savedCustomTexts), ...array(baseData.savedCustomTexts)]
      .filter((item, index, all) => index === all.findIndex((other) => other?.id === item?.id))
      .slice(0, 20),
    statistics: {
      ...baseData.statistics,
      keyStats: maxTimingStats(baseData.statistics?.keyStats, latestData.statistics?.keyStats),
      bigramStats: maxTimingStats(baseData.statistics?.bigramStats, latestData.statistics?.bigramStats),
      wordStats: maxWordStats(baseData.statistics?.wordStats, latestData.statistics?.wordStats),
      dailyActivity: mergeDailyMax(baseData.statistics?.dailyActivity, latestData.statistics?.dailyActivity),
      practiceContentHistory: [...array(latestData.statistics?.practiceContentHistory), ...array(baseData.statistics?.practiceContentHistory)]
        .filter((item, index, all) => index === all.findIndex((other) => other?.fingerprint === item?.fingerprint))
        .slice(0, 20),
    },
    attempts: mergeAttempts(baseData.attempts, latestData.attempts),
  });
}

export function mergeGuestIntoAccount(accountData, guestData) {
  if (!hasMeaningfulLocalProgress(guestData)) return validateImportedData(accountData);
  const accountCount = number(accountData.progress?.totalSessions);
  const guestCount = number(guestData.progress?.totalSessions);
  const mergedCount = accountCount + guestCount;
  const accountDisplayName = String(accountData.profile?.name || "").trim();
  const guestProfile = object(guestData.profile);
  const accountProfile = object(accountData.profile);
  const migratingProfile = {
    ...accountProfile,
    ...guestProfile,
    name: accountDisplayName && accountDisplayName !== "Learner"
      ? accountDisplayName
      : guestProfile.name || accountDisplayName || "Learner",
  };
  return validateImportedData({
    ...accountData,
    version: Math.max(number(accountData.version), number(guestData.version)),
    profile: accountData.onboarding?.completed ? accountData.profile : migratingProfile,
    settings: accountData.onboarding?.completed ? accountData.settings : guestData.settings,
    onboarding: accountData.onboarding?.completed ? accountData.onboarding : guestData.onboarding,
    adaptive: accountData.onboarding?.completed ? accountData.adaptive : guestData.adaptive,
    progress: {
      ...accountData.progress,
      activeLessonId: accountCount ? accountData.progress?.activeLessonId : guestData.progress?.activeLessonId,
      completedLessons: [...new Set([...array(accountData.progress?.completedLessons), ...array(guestData.progress?.completedLessons)])],
      lessonMastery: mergeMasteryMaps(accountData.progress?.lessonMastery, guestData.progress?.lessonMastery),
      totalPracticeSeconds: number(accountData.progress?.totalPracticeSeconds) + number(guestData.progress?.totalPracticeSeconds),
      totalSessions: mergedCount,
      totalCharacters: number(accountData.progress?.totalCharacters) + number(guestData.progress?.totalCharacters),
      totalCorrectCharacters: number(accountData.progress?.totalCorrectCharacters) + number(guestData.progress?.totalCorrectCharacters),
      bestWpm: Math.max(number(accountData.progress?.bestWpm), number(guestData.progress?.bestWpm)),
      averageWpm: weightedAverage(accountData.progress?.averageWpm, accountCount, guestData.progress?.averageWpm, guestCount),
      averageAccuracy: weightedAverage(accountData.progress?.averageAccuracy, accountCount, guestData.progress?.averageAccuracy, guestCount),
      averageConsistency: weightedAverage(accountData.progress?.averageConsistency, accountCount, guestData.progress?.averageConsistency, guestCount),
      currentStreak: Math.max(number(accountData.progress?.currentStreak), number(guestData.progress?.currentStreak)),
      longestStreak: Math.max(number(accountData.progress?.longestStreak), number(guestData.progress?.longestStreak)),
      lastPracticeDate: latestIso(accountData.progress?.lastPracticeDate, guestData.progress?.lastPracticeDate),
    },
    personalBests: Object.fromEntries([...new Set([
      ...Object.keys(object(accountData.personalBests)),
      ...Object.keys(object(guestData.personalBests)),
    ])].map((key) => {
      const a = object(accountData.personalBests?.[key]);
      const b = object(guestData.personalBests?.[key]);
      return [key, number(b.netWpm) > number(a.netWpm) ? b : a];
    })),
    savedCustomTexts: [...array(accountData.savedCustomTexts), ...array(guestData.savedCustomTexts)]
      .filter((item, index, all) => index === all.findIndex((other) => other?.id === item?.id))
      .slice(0, 20),
    statistics: {
      ...accountData.statistics,
      keyStats: addTimingStats(accountData.statistics?.keyStats, guestData.statistics?.keyStats),
      bigramStats: addTimingStats(accountData.statistics?.bigramStats, guestData.statistics?.bigramStats),
      wordStats: addWordStats(accountData.statistics?.wordStats, guestData.statistics?.wordStats),
      dailyActivity: mergeDailyAdd(accountData.statistics?.dailyActivity, guestData.statistics?.dailyActivity),
      practiceContentHistory: [...array(guestData.statistics?.practiceContentHistory), ...array(accountData.statistics?.practiceContentHistory)]
        .filter((item, index, all) => index === all.findIndex((other) => other?.fingerprint === item?.fingerprint))
        .slice(0, 20),
    },
    attempts: mergeAttempts(accountData.attempts, guestData.attempts),
  });
}

export async function pullCloudData(userId, localData, options = {}) {
  const supabase = await getSupabaseClient();
  if (!supabase || !userId) return null;

  const [profileResult, settingsResult, progressResult, masteryResult, sessionsResult, dailyResult, skillsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_progress").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("lesson_mastery").select("*").eq("user_id", userId),
    supabase.from("session_summaries").select("*").eq("user_id", userId).order("completed_at", { ascending: false }).limit(250),
    supabase.from("daily_activity").select("*").eq("user_id", userId).order("activity_date", { ascending: false }).limit(366),
    supabase.from("skill_aggregates").select("*").eq("user_id", userId).limit(5000),
  ]);

  const failure = [profileResult, settingsResult, progressResult, masteryResult, sessionsResult, dailyResult, skillsResult]
    .find((result) => result.error);
  if (failure?.error) throw failure.error;
  if (!progressResult.data) return null;

  return mergeCloudIntoLocal(localData, {
    profile: profileResult.data,
    settings: settingsResult.data,
    progress: progressResult.data,
    mastery: masteryResult.data,
    sessions: sessionsResult.data,
    dailyActivity: dailyResult.data,
    skills: skillsResult.data,
  }, options);
}
