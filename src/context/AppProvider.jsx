import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppContext } from "@/context/contextValue.js";
import {
  clearAppData,
  compactAppData,
  createFreshAppData,
  getLocalDateKey,
  loadAppData,
  saveAppData,
  saveAppDataWithStatus,
  validateImportedData,
} from "@/lib/storage";
import { createId } from "@/lib/utils";
import { getLessonById, getNextLesson } from "@/data/curriculum";
import { normalisePracticeConfig } from "@/lib/practiceRecipes";
import { useAuth } from "@/hooks/useAuth.js";
import {
  hasMeaningfulLocalProgress,
  mergeAccountLocalData,
  mergeGuestIntoAccount,
  pullCloudData,
  pushCloudData,
} from "@/lib/cloudSync.js";
import {
  dataFingerprint,
  enqueueSync,
  getDeviceId,
  getSyncOutbox,
  hasGuestMigrationMarker,
  markSyncFailure,
  markSyncSuccess,
  setGuestMigrationMarker,
  clearAccountSyncState,
} from "@/lib/syncStorage.js";
import { clearWorkspaceRecovery } from "@/lib/sessionRecovery.js";
import {
  clearAttemptDetails,
  compactAttemptSummary,
  exportAttemptDetails,
  getStorageEstimate,
  mergeAttemptDetail,
  pruneAttemptDetails,
  saveAttemptDetail,
  saveAttemptDetails,
} from "@/lib/historyStore.js";
import {
  applyGuidedLessonResult,
  determineDiagnosticPlacement,
  finaliseLessonMastery,
  getDefaultPlacement,
  getNextRecommendedLesson,
  MASTERY_STATES,
} from "@/lib/adaptiveLearning";


function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function mergeTimingStats(currentStats = {}, sessionStats = {}) {
  const next = { ...currentStats };
  Object.entries(sessionStats).forEach(([key, stat]) => {
    const current = next[key] ?? {};
    const currentFastest = current.fastestMs == null ? null : Number(current.fastestMs);
    const nextFastest = stat.fastestMs == null ? null : Number(stat.fastestMs);
    const currentSlowest = current.slowestMs == null ? null : Number(current.slowestMs);
    const nextSlowest = stat.slowestMs == null ? null : Number(stat.slowestMs);
    const confusions = { ...(current.confusions ?? {}) };

    Object.entries(stat.confusions ?? {}).forEach(([actual, count]) => {
      confusions[actual] = (Number(confusions[actual]) || 0) + (Number(count) || 0);
    });

    next[key] = {
      attempts: (Number(current.attempts) || 0) + (Number(stat.attempts) || 0),
      correct: (Number(current.correct) || 0) + (Number(stat.correct) || 0),
      errors: (Number(current.errors) || 0) + (Number(stat.errors) || 0),
      timedAttempts: (Number(current.timedAttempts) || 0) + (Number(stat.timedAttempts) || 0),
      totalLatencyMs: (Number(current.totalLatencyMs) || 0) + (Number(stat.totalLatencyMs) || 0),
      fastestMs: nextFastest !== null && Number.isFinite(nextFastest)
        ? currentFastest !== null && Number.isFinite(currentFastest) ? Math.min(currentFastest, nextFastest) : nextFastest
        : currentFastest !== null && Number.isFinite(currentFastest) ? currentFastest : null,
      slowestMs: nextSlowest !== null && Number.isFinite(nextSlowest)
        ? currentSlowest !== null && Number.isFinite(currentSlowest) ? Math.max(currentSlowest, nextSlowest) : nextSlowest
        : currentSlowest !== null && Number.isFinite(currentSlowest) ? currentSlowest : null,
      confusions,
      lastPractisedAt: new Date().toISOString(),
    };
  });
  return next;
}

function mergeWordStats(currentStats, mistakeWords = []) {
  const next = { ...currentStats };
  mistakeWords.forEach((item) => {
    const expected = String(item.expected || "").trim().toLowerCase();
    if (!expected) return;
    const current = next[expected] ?? { errors: 0, lastTyped: "" };
    next[expected] = {
      errors: (Number(current.errors) || 0) + 1,
      lastTyped: item.typed,
      lastPractisedAt: new Date().toISOString(),
    };
  });
  return next;
}

function calculateStreak(progress, todayKey) {
  if (progress.lastPracticeDate === todayKey) {
    return {
      currentStreak: Math.max(progress.currentStreak, 1),
      longestStreak: Math.max(progress.longestStreak, progress.currentStreak, 1),
    };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const continued = progress.lastPracticeDate === getLocalDateKey(yesterday);
  const currentStreak = continued ? Math.max(progress.currentStreak, 0) + 1 : 1;

  return {
    currentStreak,
    longestStreak: Math.max(progress.longestStreak, currentStreak),
  };
}

function weightedAverage(currentAverage, currentCount, nextValue) {
  return ((currentAverage * currentCount) + nextValue) / Math.max(1, currentCount + 1);
}

function applyAuthenticatedProfile(data, user) {
  const displayName = String(user?.user_metadata?.display_name || "").trim();
  if (!displayName || String(data.profile?.name || "").trim() !== "Learner") return data;
  return {
    ...data,
    profile: { ...data.profile, name: displayName.slice(0, 40) },
  };
}

const AUTO_SYNC_DELAY_MS = 350;
const FOLLOW_UP_SYNC_DELAY_MS = 60;

export function AppProvider({ children }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState(() => ({ userId: null, data: loadAppData(null) }));
  const data = workspace.data;
  const [resolvedTheme, setResolvedTheme] = useState("light");
  const [syncStatus, setSyncStatus] = useState("local");
  const [syncError, setSyncError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [storageHealth, setStorageHealth] = useState({
    status: "checking",
    localBytes: 0,
    detailBytes: 0,
    detailCount: 0,
    knownBytes: 0,
    usage: null,
    quota: null,
    usageRatio: null,
    warning: false,
    error: "",
  });
  const [cloudReadyForUser, setCloudReadyForUser] = useState(null);
  const workspaceRef = useRef(workspace);
  const reconcileGenerationRef = useRef(0);
  const syncPromiseRef = useRef(null);
  const syncFollowUpRef = useRef(false);
  const syncTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const performSyncRef = useRef(null);
  const knownAttemptIdsRef = useRef(new Set(data.attempts.map((item) => String(item.id))));
  const dataMutationRevisionRef = useRef(0);

  const setData = useCallback((updater) => {
    dataMutationRevisionRef.current += 1;
    setWorkspace((current) => ({
      ...current,
      data: typeof updater === "function" ? updater(current.data) : updater,
    }));
  }, []);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const refreshStorageHealth = useCallback(async () => {
    const active = workspaceRef.current;
    setStorageHealth((current) => ({ ...current, status: "checking", error: "" }));
    try {
      const browserEstimate = await getStorageEstimate(active.userId, active.data);
      const detailStats = browserEstimate;
      const localResult = saveAppDataWithStatus(active.data, active.userId);
      const usage = Number.isFinite(Number(browserEstimate?.usage)) ? Number(browserEstimate.usage) : null;
      const quota = Number.isFinite(Number(browserEstimate?.quota)) ? Number(browserEstimate.quota) : null;
      const usageRatio = usage !== null && quota ? usage / quota : null;
      const knownBytes = Math.max(0, Number(localResult.bytes) || 0) + Math.max(0, Number(detailStats.detailBytes) || 0);
      setStorageHealth({
        status: localResult.ok ? "ready" : "error",
        localBytes: Math.max(0, Number(localResult.bytes) || 0),
        detailBytes: Math.max(0, Number(detailStats.detailBytes) || 0),
        detailCount: Math.max(0, Number(detailStats.detailCount) || 0),
        knownBytes,
        usage,
        quota,
        usageRatio,
        warning: Boolean((usageRatio !== null && usageRatio >= 0.8) || knownBytes >= 20 * 1024 * 1024),
        error: localResult.error || "",
      });
      return { ...detailStats, ...browserEstimate, localBytes: localResult.bytes, knownBytes };
    } catch (error) {
      setStorageHealth((current) => ({
        ...current,
        status: "error",
        error: error?.message || "Storage usage could not be checked.",
      }));
      return null;
    }
  }, []);

  const pruneHistory = useCallback(async ({ keep = 200 } = {}) => {
    const active = workspaceRef.current;
    const protectedIds = active.userId ? getSyncOutbox(active.userId).sessionIds : [];
    const result = await pruneAttemptDetails(active.userId, { keep, protectedIds });
    await refreshStorageHealth();
    return result;
  }, [refreshStorageHealth]);

  const clearSyncTimers = useCallback(() => {
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    syncTimerRef.current = null;
    retryTimerRef.current = null;
    syncFollowUpRef.current = false;
  }, []);

  const performSync = useCallback(async ({
    userId: requestedUserId = null,
    dataOverride = null,
    manual = false,
  } = {}) => {
    const userId = requestedUserId || workspaceRef.current.userId;
    if (!userId || !isAuthenticated || user?.id !== userId) return false;
    if (syncPromiseRef.current?.userId === userId) {
      syncFollowUpRef.current = true;
      return syncPromiseRef.current.promise;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setSyncStatus("offline");
      setSyncError("You are offline. Progress is safe on this device and will sync after reconnection.");
      return false;
    }

    if (manual) enqueueSync(userId, { snapshot: true });
    const outbox = getSyncOutbox(userId);
    const payload = dataOverride || workspaceRef.current.data;
    const mutationRevisionAtStart = dataMutationRevisionRef.current;
    if (!outbox.snapshotPending && outbox.sessionIds.length === 0 && !manual) {
      setSyncStatus("synced");
      return true;
    }

    setSyncStatus("syncing");
    setSyncError("");
    const request = (async () => {
      try {
        const result = await pushCloudData(userId, payload, {
          sessionIds: outbox.sessionIds,
          deviceId: getDeviceId(),
          localRevision: Date.now(),
        });
        const remainingOutbox = markSyncSuccess(userId, {
          sessionIds: result.syncedSessionIds,
          clearSnapshot: dataMutationRevisionRef.current === mutationRevisionAtStart,
          snapshotRevision: outbox.snapshotRevision,
        });
        await pruneAttemptDetails(userId, {
          keep: 200,
          protectedIds: remainingOutbox.sessionIds,
        });
        if (workspaceRef.current.userId === userId && user?.id === userId) {
          const needsFollowUp = syncFollowUpRef.current
            || remainingOutbox.snapshotPending
            || remainingOutbox.sessionIds.length > 0;
          syncFollowUpRef.current = false;
          setSyncStatus(needsFollowUp ? "syncing" : "synced");
          setSyncError("");
          await refreshStorageHealth();
          if (needsFollowUp) {
            if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
            syncTimerRef.current = window.setTimeout(
              () => performSyncRef.current?.(),
              FOLLOW_UP_SYNC_DELAY_MS,
            );
          }
        }
        return true;
      } catch (error) {
        syncFollowUpRef.current = false;
        const failed = markSyncFailure(userId);
        if (workspaceRef.current.userId === userId && user?.id === userId) {
          const offline = typeof navigator !== "undefined" && navigator.onLine === false;
          setSyncStatus(offline ? "offline" : "error");
          setSyncError(error.message || "Cloud sync failed. Local progress is safe.");
          const nextAt = Date.parse(failed.nextRetryAt || "");
          const delay = Number.isFinite(nextAt) ? Math.max(1000, nextAt - Date.now()) : 5000;
          if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = window.setTimeout(() => performSyncRef.current?.(), delay);
        }
        return false;
      } finally {
        if (syncPromiseRef.current?.userId === userId) syncPromiseRef.current = null;
      }
    })();
    syncPromiseRef.current = { userId, promise: request };
    return request;
  }, [isAuthenticated, refreshStorageHealth, user?.id]);

  performSyncRef.current = performSync;

  const syncNow = useCallback(async () => performSync({ manual: true }), [performSync]);

  useEffect(() => {
    const saveResult = saveAppDataWithStatus(workspace.data, workspace.userId);
    setStorageHealth((current) => ({
      ...current,
      status: saveResult.ok ? (current.status === "checking" ? "checking" : "ready") : "error",
      localBytes: saveResult.bytes || current.localBytes,
      knownBytes: (saveResult.bytes || current.localBytes) + current.detailBytes,
      error: saveResult.error || "",
    }));

    if (!workspace.userId || cloudReadyForUser !== workspace.userId) return;
    const currentIds = new Set(workspace.data.attempts.map((item) => String(item.id)));
    const newSessionIds = [...currentIds].filter((id) => !knownAttemptIdsRef.current.has(id));
    knownAttemptIdsRef.current = currentIds;
    enqueueSync(workspace.userId, { sessionIds: newSessionIds, snapshot: true });

    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      setSyncStatus("syncing");
      setSyncError("");
    }
    syncTimerRef.current = window.setTimeout(() => performSyncRef.current?.(), AUTO_SYNC_DELAY_MS);
  }, [cloudReadyForUser, workspace]);

  useEffect(() => {
    if (authLoading) return undefined;
    const generation = ++reconcileGenerationRef.current;
    clearSyncTimers();
    saveAppData(workspaceRef.current.data, workspaceRef.current.userId);

    if (!isAuthenticated || !user?.id) {
      setCloudReadyForUser(null);
      setSyncStatus("local");
      setSyncError("");
      setSyncNotice("");
      const guestData = loadAppData(null);
      knownAttemptIdsRef.current = new Set(guestData.attempts.map((item) => String(item.id)));
      setWorkspace({ userId: null, data: guestData });
      return undefined;
    }

    const userId = user.id;
    const startingMutationRevision = dataMutationRevisionRef.current;
    const pendingBeforePull = getSyncOutbox(userId);
    const localAccount = applyAuthenticatedProfile(loadAppData(userId), user);
    knownAttemptIdsRef.current = new Set(localAccount.attempts.map((item) => String(item.id)));
    setWorkspace({ userId, data: localAccount });
    setCloudReadyForUser(null);
    setSyncStatus(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "syncing");
    setSyncError("");
    setSyncNotice("");

    (async () => {
      let accountData = localAccount;
      let migratedGuest = false;
      const sessionIdsToSync = new Set(pendingBeforePull.sessionIds.map(String));
      try {
        const cloudData = await pullCloudData(userId, localAccount);
        if (generation !== reconcileGenerationRef.current || user?.id !== userId) return;
        const latestLocal = workspaceRef.current.userId === userId
          ? workspaceRef.current.data
          : localAccount;
        const changedDuringPull = dataMutationRevisionRef.current > startingMutationRevision;
        const hasPendingLocalChanges = pendingBeforePull.snapshotPending
          || pendingBeforePull.sessionIds.length > 0;
        latestLocal.attempts.forEach((attempt) => {
          if (!localAccount.attempts.some((item) => String(item.id) === String(attempt.id))) {
            sessionIdsToSync.add(String(attempt.id));
          }
        });
        if (cloudData) accountData = changedDuringPull || hasPendingLocalChanges
          ? mergeAccountLocalData(cloudData, latestLocal, { preferLatestSnapshot: true })
          : cloudData;
        else {
          accountData = latestLocal;
          latestLocal.attempts.forEach((attempt) => sessionIdsToSync.add(String(attempt.id)));
        }

        const guestData = loadAppData(null);
        const fingerprint = dataFingerprint(guestData);
        if (
          hasMeaningfulLocalProgress(guestData)
          && !hasGuestMigrationMarker(userId, fingerprint)
        ) {
          accountData = mergeGuestIntoAccount(accountData, guestData);
          const guestDetails = await exportAttemptDetails(null);
          if (guestDetails.length) await saveAttemptDetails(userId, guestDetails);
          guestData.attempts.forEach((attempt) => sessionIdsToSync.add(String(attempt.id)));
          setGuestMigrationMarker(userId, fingerprint);
          migratedGuest = true;
          setSyncNotice(cloudData
            ? "Guest progress was merged with the progress already stored in this account."
            : "Guest progress was moved into your new account.");
        }

        if (generation !== reconcileGenerationRef.current || user?.id !== userId) return;
        accountData = compactAppData(accountData);
        saveAppData(accountData, userId);
        knownAttemptIdsRef.current = new Set(accountData.attempts.map((item) => String(item.id)));
        setWorkspace({ userId, data: accountData });
        enqueueSync(userId, {
          sessionIds: [...sessionIdsToSync],
          snapshot: true,
        });
        setCloudReadyForUser(userId);
        const success = await performSync({ userId, dataOverride: accountData });
        if (
          success
          && migratedGuest
          && generation === reconcileGenerationRef.current
          && user?.id === userId
        ) {
          clearAppData(null);
          await clearAttemptDetails(null);
        }
      } catch (error) {
        if (generation !== reconcileGenerationRef.current || user?.id !== userId) return;
        const latestLocal = workspaceRef.current.userId === userId
          ? workspaceRef.current.data
          : accountData;
        latestLocal.attempts.forEach((attempt) => {
          if (!localAccount.attempts.some((item) => String(item.id) === String(attempt.id))) {
            sessionIdsToSync.add(String(attempt.id));
          }
        });
        accountData = mergeAccountLocalData(accountData, latestLocal, { preferLatestSnapshot: true });
        saveAppData(accountData, userId);
        setWorkspace({ userId, data: accountData });
        enqueueSync(userId, {
          sessionIds: [...sessionIdsToSync],
          snapshot: true,
        });
        setCloudReadyForUser(userId);
        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        setSyncStatus(offline ? "offline" : "error");
        setSyncError(error.message || "Cloud progress could not be loaded. Local account data remains available.");
      }
    })();

    return () => {
      reconcileGenerationRef.current += 1;
    };
  }, [authLoading, clearSyncTimers, isAuthenticated, performSync, user, user?.id]);

  useEffect(() => {
    const handleOnline = () => {
      if (workspaceRef.current.userId) performSyncRef.current?.({ manual: true });
    };
    const handleOffline = () => {
      if (workspaceRef.current.userId) {
        setSyncStatus("offline");
        setSyncError("You are offline. Progress is safe on this device and will sync after reconnection.");
      }
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearSyncTimers();
    };
  }, [clearSyncTimers]);

  useEffect(() => {
    void refreshStorageHealth();
  }, [refreshStorageHealth, workspace.userId]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const theme = data.settings.theme === "system" ? getSystemTheme() : data.settings.theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.style.colorScheme = theme;
      setResolvedTheme(theme);
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [data.settings.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", Boolean(data.settings.reduceMotion));
  }, [data.settings.reduceMotion]);

  const updateProfile = useCallback((updates) => {
    setData((current) => ({
      ...current,
      profile: { ...current.profile, ...updates },
    }));
  }, [setData]);

  const updateSettings = useCallback((updates) => {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, ...updates },
    }));
  }, [setData]);

  const finishOnboarding = useCallback((updates = {}) => {
    setData((current) => {
      const profile = { ...current.profile, ...(updates.profile ?? {}) };
      const placement = current.onboarding.diagnosticCompleted
        ? current.adaptive.placement
        : getDefaultPlacement(profile);
      return {
        ...current,
        profile,
        settings: { ...current.settings, ...(updates.settings ?? {}) },
        onboarding: { ...current.onboarding, completed: true },
        adaptive: { ...current.adaptive, placement },
        progress: {
          ...current.progress,
          activeLessonId: placement.startLessonId,
        },
      };
    });
  }, [setData]);

  const saveDiagnostic = useCallback((result) => {
    setData((current) => {
      const placement = determineDiagnosticPlacement({ profile: current.profile, result });
      return {
        ...current,
        onboarding: {
          ...current.onboarding,
          diagnosticCompleted: true,
          diagnosticResult: {
            ...result,
            completedAt: new Date().toISOString(),
            placementLevel: placement.level,
            startLessonId: placement.startLessonId,
          },
        },
        adaptive: { ...current.adaptive, placement },
        progress: {
          ...current.progress,
          activeLessonId: placement.startLessonId,
        },
      };
    });
  }, [setData]);

  const setActiveLesson = useCallback((lessonId) => {
    setData((current) => ({
      ...current,
      progress: { ...current.progress, activeLessonId: lessonId },
    }));
  }, [setData]);

  const completeLesson = useCallback((lessonId) => {
    setData((current) => {
      const lesson = getLessonById(lessonId);
      const existingMastery = current.progress.lessonMastery[lessonId] ?? {};
      const mastery = finaliseLessonMastery(existingMastery, lesson);
      const mastered = [MASTERY_STATES.MASTERED, MASTERY_STATES.REVIEW_DUE].includes(mastery.state);
      const completedLessons = mastered && !current.progress.completedLessons.includes(lessonId)
        ? [...current.progress.completedLessons, lessonId]
        : current.progress.completedLessons;
      const provisional = {
        ...current,
        progress: {
          ...current.progress,
          completedLessons,
          lessonMastery: {
            ...current.progress.lessonMastery,
            [lessonId]: mastery,
          },
        },
      };
      const nextLesson = mastered
        ? getNextRecommendedLesson(provisional)
        : getLessonById(lessonId);

      return {
        ...provisional,
        progress: {
          ...provisional.progress,
          activeLessonId: nextLesson?.id ?? getNextLesson(lessonId)?.id ?? lessonId,
        },
      };
    });
  }, [setData]);

  const saveLastPracticeConfig = useCallback((config) => {
    setData((current) => ({
      ...current,
      lastPracticeConfig: normalisePracticeConfig({ ...current.lastPracticeConfig, ...config }),
    }));
  }, [setData]);

  const saveCustomText = useCallback((title, text) => {
    const cleanText = String(text || "").trim();
    if (!cleanText) return;
    setData((current) => ({
      ...current,
      savedCustomTexts: [
        {
          id: createId("text"),
          title: String(title || "Custom text").trim() || "Custom text",
          text: cleanText.slice(0, 12000),
          createdAt: new Date().toISOString(),
        },
        ...current.savedCustomTexts,
      ].slice(0, 20),
    }));
  }, [setData]);

  const deleteCustomText = useCallback((id) => {
    setData((current) => ({
      ...current,
      savedCustomTexts: current.savedCustomTexts.filter((item) => item.id !== id),
    }));
  }, [setData]);

  const recordSession = useCallback((session) => {
    const durationSeconds = Math.max(1, Math.round(Number(session.durationSeconds) || 1));
    const netWpm = Math.max(0, Number(session.netWpm) || 0);
    const accuracy = Math.min(100, Math.max(0, Number(session.accuracy) || 0));
    const consistency = Math.min(100, Math.max(0, Number(session.consistency) || 0));
    const charactersTyped = Math.max(0, Number(session.charactersTyped) || 0);
    const correctCharacters = Math.max(0, Number(session.correctCharacters) || 0);
    const todayKey = getLocalDateKey();
    const attemptUserId = workspaceRef.current.userId;
    const attemptBase = {
      id: createId("attempt"),
      completedAt: new Date().toISOString(),
      activityDate: todayKey,
      ...session,
      durationSeconds,
      netWpm: Math.round(netWpm * 10) / 10,
      rawWpm: Math.round((Number(session.rawWpm) || 0) * 10) / 10,
      accuracy: Math.round(accuracy * 10) / 10,
      consistency: Math.round(consistency),
      charactersTyped,
      correctCharacters,
      paceSamples: Array.isArray(session.paceSamples) ? session.paceSamples.slice(-180) : [],
    };

    void saveAttemptDetail(attemptUserId, attemptBase).then(async () => {
      const protectedIds = attemptUserId ? getSyncOutbox(attemptUserId).sessionIds : [];
      await pruneAttemptDetails(attemptUserId, { keep: 200, protectedIds });
      if (workspaceRef.current.userId === attemptUserId) await refreshStorageHealth();
    }).catch((error) => {
      console.warn("Typing Master could not save detailed session history.", error);
      setStorageHealth((current) => ({
        ...current,
        status: "error",
        error: error?.message || "Detailed session history could not be saved.",
      }));
    });

    setData((current) => {
      const previousCount = current.progress.totalSessions;
      const totalSessions = previousCount + 1;
      const streak = calculateStreak(current.progress, todayKey);
      const currentDay = current.statistics.dailyActivity[todayKey] ?? {
        seconds: 0,
        sessions: 0,
        characters: 0,
        bestWpm: 0,
        averageAccuracy: 0,
      };
      const attempt = attemptBase;

      const testKey = session.testId || (session.type === "diagnostic" ? session.modeId : null);
      const previousBest = testKey ? current.personalBests[testKey] : null;
      const personalBestEligible = Boolean(session.personalBestEligible ?? session.validSession ?? true);
      const scoreEligible = testKey ? personalBestEligible : session.validSession !== false;
      const isPersonalBest = Boolean(testKey)
        && personalBestEligible
        && (!previousBest || netWpm > previousBest.netWpm);
      const personalBests = isPersonalBest
        ? {
            ...current.personalBests,
            [testKey]: {
              netWpm: Math.round(netWpm * 10) / 10,
              accuracy: Math.round(accuracy * 10) / 10,
              completedAt: attempt.completedAt,
            },
          }
        : current.personalBests;

      const contentHistoryEntry = session.type === "practice" && session.contentFingerprint
        ? {
            fingerprint: String(session.contentFingerprint),
            contentType: session.contentType || "words",
            category: session.category || "general",
            purpose: session.practicePurpose || session.purpose || "balanced",
            items: Array.isArray(session.contentItems)
              ? session.contentItems.filter(Boolean).slice(0, 40)
              : [],
            completedAt: attempt.completedAt,
          }
        : null;
      const practiceContentHistory = contentHistoryEntry
        ? [
            contentHistoryEntry,
            ...(current.statistics.practiceContentHistory ?? [])
              .filter((item) => item?.fingerprint !== contentHistoryEntry.fingerprint),
          ].slice(0, 20)
        : current.statistics.practiceContentHistory ?? [];

      let lessonMastery = current.progress.lessonMastery;
      let completedLessons = current.progress.completedLessons;
      if (session.type === "lesson" && session.practiceMode === "guided" && session.lessonId) {
        const lesson = getLessonById(session.lessonId);
        if (lesson) {
          const updatedMastery = applyGuidedLessonResult(
            lessonMastery[session.lessonId] ?? {},
            { ...session, ...attempt },
            lesson,
            { baselineWpm: current.progress.averageWpm || netWpm },
          );
          lessonMastery = {
            ...lessonMastery,
            [session.lessonId]: updatedMastery,
          };
          if (
            [MASTERY_STATES.MASTERED, MASTERY_STATES.REVIEW_DUE].includes(updatedMastery.state)
            && !completedLessons.includes(session.lessonId)
          ) {
            completedLessons = [...completedLessons, session.lessonId];
          }
        }
      }

      const summary = compactAttemptSummary({ ...attempt, isPersonalBest });
      const attempts = [summary, ...current.attempts.filter((item) => String(item.id) !== String(summary.id))]
        .slice(0, 1000);

      return {
        ...current,
        progress: {
          ...current.progress,
          totalPracticeSeconds: current.progress.totalPracticeSeconds + durationSeconds,
          totalSessions,
          completedLessons,
          totalCharacters: current.progress.totalCharacters + charactersTyped,
          totalCorrectCharacters: current.progress.totalCorrectCharacters + correctCharacters,
          bestWpm: scoreEligible
            ? Math.max(current.progress.bestWpm, Math.round(netWpm))
            : current.progress.bestWpm,
          averageWpm: Math.round(weightedAverage(current.progress.averageWpm, previousCount, netWpm) * 10) / 10,
          averageAccuracy: Math.round(weightedAverage(current.progress.averageAccuracy, previousCount, accuracy) * 10) / 10,
          averageConsistency: Math.round(weightedAverage(current.progress.averageConsistency, previousCount, consistency)),
          lessonMastery,
          ...streak,
          lastPracticeDate: todayKey,
        },
        statistics: {
          ...current.statistics,
          keyStats: mergeTimingStats(current.statistics.keyStats, session.keyStats),
          bigramStats: mergeTimingStats(current.statistics.bigramStats, session.bigramStats),
          wordStats: mergeWordStats(current.statistics.wordStats, session.mistakeWords),
          practiceContentHistory,
          dailyActivity: {
            ...current.statistics.dailyActivity,
            [todayKey]: {
              seconds: currentDay.seconds + durationSeconds,
              sessions: currentDay.sessions + 1,
              characters: currentDay.characters + charactersTyped,
              bestWpm: scoreEligible
                ? Math.max(currentDay.bestWpm || 0, Math.round(netWpm))
                : currentDay.bestWpm || 0,
              averageAccuracy: Math.round(weightedAverage(
                currentDay.averageAccuracy || 0,
                currentDay.sessions || 0,
                accuracy,
              ) * 10) / 10,
            },
          },
        },
        personalBests,
        attempts,
      };
    });
  }, [refreshStorageHealth, setData]);

  const exportData = useCallback(async () => {
    const active = workspaceRef.current;
    const details = await exportAttemptDetails(active.userId);
    const detailMap = new Map(details.map((item) => [String(item.id), item]));
    const attempts = active.data.attempts.map((summary) => (
      mergeAttemptDetail(summary, detailMap.get(String(summary.id)))
    ));
    return {
      ...active.data,
      version: 9,
      backupFormat: "typing-master-full-v1",
      exportedAt: new Date().toISOString(),
      attempts,
    };
  }, []);

  const importData = useCallback(async (value) => {
    const validated = validateImportedData(value);
    const userId = workspaceRef.current.userId;
    const details = validated.attempts.filter((attempt) => attempt?.id);
    if (details.length) await saveAttemptDetails(userId, details);
    const merged = mergeAccountLocalData(
      workspaceRef.current.data,
      validated,
      { preferLatestSnapshot: true },
    );
    setData(compactAppData(merged));
    await refreshStorageHealth();
  }, [refreshStorageHealth, setData]);

  const resetData = useCallback(async () => {
    if (workspaceRef.current.userId) return false;
    clearAppData(null);
    await clearAttemptDetails(null);
    setData(createFreshAppData());
    await refreshStorageHealth();
    return true;
  }, [refreshStorageHealth, setData]);

  const clearDeletedAccountData = useCallback(async (userId) => {
    if (!userId) return;
    clearAppData(userId);
    clearAccountSyncState(userId);
    clearWorkspaceRecovery(`user:${userId}`);
    await clearAttemptDetails(userId);
    if (workspaceRef.current.userId === userId) {
      const guestData = loadAppData(null);
      knownAttemptIdsRef.current = new Set(guestData.attempts.map((item) => String(item.id)));
      setWorkspace({ userId: null, data: guestData });
      setCloudReadyForUser(null);
      setSyncStatus("local");
      setSyncError("");
      setSyncNotice("Account and cloud data were deleted. Guest mode remains available on this device.");
    }
    await refreshStorageHealth();
  }, [refreshStorageHealth]);

  const value = useMemo(() => ({
    data,
    resolvedTheme,
    updateProfile,
    updateSettings,
    finishOnboarding,
    saveDiagnostic,
    setActiveLesson,
    completeLesson,
    saveLastPracticeConfig,
    saveCustomText,
    deleteCustomText,
    recordSession,
    exportData,
    importData,
    resetData,
    clearDeletedAccountData,
    storageHealth,
    refreshStorageHealth,
    pruneHistory,
    workspaceId: workspace.userId ? `user:${workspace.userId}` : "guest",
    syncStatus,
    syncError,
    syncNotice,
    syncNow,
    cloudSync: { status: syncStatus, error: syncError },
  }), [
    data,
    resolvedTheme,
    updateProfile,
    updateSettings,
    finishOnboarding,
    saveDiagnostic,
    setActiveLesson,
    completeLesson,
    saveLastPracticeConfig,
    saveCustomText,
    deleteCustomText,
    recordSession,
    exportData,
    importData,
    resetData,
    clearDeletedAccountData,
    storageHealth,
    refreshStorageHealth,
    pruneHistory,
    workspace.userId,
    syncStatus,
    syncError,
    syncNotice,
    syncNow,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
