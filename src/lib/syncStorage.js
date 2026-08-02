const OUTBOX_PREFIX = "typing-master:outbox:";
const MIGRATION_PREFIX = "typing-master:guest-migration:";
const DEVICE_KEY = "typing-master:device-id";

export const OUTBOX_SESSION_LIMIT = 1000;

function defaultStorage() {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function createId(prefix = "device") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(storage = defaultStorage()) {
  if (!storage) return "device-unavailable";
  const existing = storage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = createId();
  storage.setItem(DEVICE_KEY, id);
  return id;
}

export function getOutboxKey(userId) {
  return `${OUTBOX_PREFIX}${userId}`;
}

export function getSyncOutbox(userId, storage = defaultStorage()) {
  if (!storage || !userId) {
    return { version: 2, snapshotPending: false, snapshotRevision: 0, sessionIds: [], retryCount: 0, nextRetryAt: null };
  }
  const value = safeParse(storage.getItem(getOutboxKey(userId)), {});
  return {
    version: 2,
    snapshotPending: Boolean(value.snapshotPending),
    snapshotRevision: Math.max(0, Number(value.snapshotRevision) || 0),
    sessionIds: [...new Set(Array.isArray(value.sessionIds) ? value.sessionIds.filter(Boolean).map(String) : [])].slice(-OUTBOX_SESSION_LIMIT),
    retryCount: Math.max(0, Number(value.retryCount) || 0),
    nextRetryAt: value.nextRetryAt || null,
  };
}

export function saveSyncOutbox(userId, outbox, storage = defaultStorage()) {
  if (!storage || !userId) return;
  storage.setItem(getOutboxKey(userId), JSON.stringify({
    version: 2,
    snapshotPending: Boolean(outbox.snapshotPending),
    snapshotRevision: Math.max(0, Number(outbox.snapshotRevision) || 0),
    sessionIds: [...new Set(Array.isArray(outbox.sessionIds) ? outbox.sessionIds.filter(Boolean).map(String) : [])].slice(-OUTBOX_SESSION_LIMIT),
    retryCount: Math.max(0, Number(outbox.retryCount) || 0),
    nextRetryAt: outbox.nextRetryAt || null,
  }));
}

export function enqueueSync(userId, { sessionIds = [], snapshot = true, snapshotRevision = null } = {}, storage = defaultStorage()) {
  const current = getSyncOutbox(userId, storage);
  const nextRevision = snapshot
    ? Math.max(current.snapshotRevision + 1, Number(snapshotRevision) || Date.now())
    : current.snapshotRevision;
  const next = {
    ...current,
    snapshotPending: current.snapshotPending || Boolean(snapshot),
    snapshotRevision: nextRevision,
    sessionIds: [...new Set([...current.sessionIds, ...sessionIds.filter(Boolean).map(String)])].slice(-OUTBOX_SESSION_LIMIT),
  };
  saveSyncOutbox(userId, next, storage);
  return next;
}

export function markSyncFailure(userId, storage = defaultStorage(), now = Date.now()) {
  const current = getSyncOutbox(userId, storage);
  const retryCount = Math.min(current.retryCount + 1, 12);
  const delays = [2000, 5000, 15000, 30000, 60000, 120000, 300000];
  const delay = delays[Math.min(retryCount - 1, delays.length - 1)];
  const next = {
    ...current,
    retryCount,
    nextRetryAt: new Date(now + delay).toISOString(),
  };
  saveSyncOutbox(userId, next, storage);
  return next;
}

export function markSyncSuccess(userId, { sessionIds = [], clearSnapshot = true, snapshotRevision = null } = {}, storage = defaultStorage()) {
  const current = getSyncOutbox(userId, storage);
  const completed = new Set(sessionIds.map(String));
  const syncedRevision = Number(snapshotRevision);
  const hasSyncedRevision = snapshotRevision !== null
    && snapshotRevision !== undefined
    && Number.isFinite(syncedRevision);
  const canClearSnapshot = clearSnapshot && (
    !hasSyncedRevision
    || current.snapshotRevision <= syncedRevision
  );
  const next = {
    ...current,
    snapshotPending: canClearSnapshot ? false : current.snapshotPending,
    sessionIds: current.sessionIds.filter((id) => !completed.has(id)),
    retryCount: 0,
    nextRetryAt: null,
  };
  saveSyncOutbox(userId, next, storage);
  return next;
}

export function clearSyncOutbox(userId, storage = defaultStorage()) {
  if (!storage || !userId) return;
  storage.removeItem(getOutboxKey(userId));
}

export function dataFingerprint(data = {}) {
  const attempts = Array.isArray(data.attempts) ? data.attempts.map((item) => item?.id).filter(Boolean).sort() : [];
  return JSON.stringify({
    joinedAt: data.profile?.joinedAt || "",
    sessions: Number(data.progress?.totalSessions) || 0,
    completed: Array.isArray(data.progress?.completedLessons) ? [...data.progress.completedLessons].sort() : [],
    attempts,
  });
}

export function hasGuestMigrationMarker(userId, fingerprint, storage = defaultStorage()) {
  if (!storage || !userId || !fingerprint) return false;
  return storage.getItem(`${MIGRATION_PREFIX}${userId}`) === fingerprint;
}

export function setGuestMigrationMarker(userId, fingerprint, storage = defaultStorage()) {
  if (!storage || !userId || !fingerprint) return;
  storage.setItem(`${MIGRATION_PREFIX}${userId}`, fingerprint);
}

export function clearAccountSyncState(userId, storage = defaultStorage()) {
  if (!storage || !userId) return;
  storage.removeItem(getOutboxKey(userId));
  storage.removeItem(`${MIGRATION_PREFIX}${userId}`);
}
