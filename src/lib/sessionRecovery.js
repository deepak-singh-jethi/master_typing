const RECOVERY_PREFIX = "typing-master:active-session:";
export const RECOVERY_VERSION = 1;
export const RECOVERY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function defaultStorage() {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function hashText(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildRecoveryIdentity({ workspaceId = "guest", target = "", durationSeconds = null, backspaceMode = "allowed", sessionId = "session" } = {}) {
  const normalisedSessionId = String(sessionId || "session");
  return {
    key: `${RECOVERY_PREFIX}${workspaceId}:${hashText(normalisedSessionId)}`,
    legacyKey: `${RECOVERY_PREFIX}${workspaceId}`,
    targetHash: hashText(target),
    targetLength: target.length,
    durationSeconds: durationSeconds == null ? null : Number(durationSeconds),
    backspaceMode,
    sessionId: normalisedSessionId,
  };
}

function safeClone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function createRecoverySnapshot({ identity, telemetry, elapsedMs = 0, paceSamples = [], status = "paused", savedAt = new Date().toISOString() } = {}) {
  return {
    version: RECOVERY_VERSION,
    key: identity?.key,
    targetHash: identity?.targetHash,
    targetLength: identity?.targetLength,
    durationSeconds: identity?.durationSeconds ?? null,
    backspaceMode: identity?.backspaceMode,
    sessionId: identity?.sessionId,
    status: status === "running" ? "paused" : status,
    telemetry: safeClone(telemetry),
    elapsedMs: Math.max(0, Number(elapsedMs) || 0),
    paceSamples: Array.isArray(paceSamples) ? paceSamples.slice(-3600) : [],
    savedAt,
  };
}

export function isRecoverySnapshotCompatible(snapshot, identity, now = Date.now()) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (Number(snapshot.version) !== RECOVERY_VERSION) return false;
  if (snapshot.targetHash !== identity.targetHash) return false;
  if (Number(snapshot.targetLength) !== Number(identity.targetLength)) return false;
  if ((snapshot.durationSeconds ?? null) !== (identity.durationSeconds ?? null)) return false;
  if (snapshot.backspaceMode !== identity.backspaceMode) return false;
  if (snapshot.sessionId !== identity.sessionId) return false;
  const savedAt = Date.parse(snapshot.savedAt || "");
  if (!Number.isFinite(savedAt) || now - savedAt > RECOVERY_MAX_AGE_MS) return false;
  if (!snapshot.telemetry || typeof snapshot.telemetry !== "object") return false;
  return Boolean(String(snapshot.telemetry.typed || "").length);
}

export function saveRecoverySnapshot(identity, snapshot, storage = defaultStorage()) {
  if (!storage || !identity?.key) return false;
  try {
    storage.setItem(identity.key, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    console.warn("Typing Master could not save active-session recovery data.", error);
    return false;
  }
}

function readSnapshot(key, storage) {
  if (!key) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

export function loadRecoverySnapshot(identity, storage = defaultStorage(), now = Date.now()) {
  if (!storage || !identity?.key) return null;
  try {
    const snapshot = readSnapshot(identity.key, storage);
    if (snapshot) {
      if (!isRecoverySnapshotCompatible(snapshot, identity, now)) {
        storage.removeItem(identity.key);
        return null;
      }
      return snapshot;
    }

    // Migrate the pre-multi-session recovery slot when it belongs to this exact session.
    const legacy = identity.legacyKey ? readSnapshot(identity.legacyKey, storage) : null;
    if (legacy && isRecoverySnapshotCompatible(legacy, identity, now)) {
      storage.setItem(identity.key, JSON.stringify(legacy));
      storage.removeItem(identity.legacyKey);
      return legacy;
    }
    return null;
  } catch {
    try { storage.removeItem(identity.key); } catch { /* best effort */ }
    return null;
  }
}

export function clearRecoverySnapshot(identity, storage = defaultStorage()) {
  if (!storage || !identity?.key) return;
  try { storage.removeItem(identity.key); } catch { /* best effort */ }

  if (!identity.legacyKey) return;
  try {
    const legacy = readSnapshot(identity.legacyKey, storage);
    if (legacy && isRecoverySnapshotCompatible(legacy, identity)) storage.removeItem(identity.legacyKey);
  } catch {
    // Legacy cleanup is best effort only.
  }
}

export function clearWorkspaceRecovery(workspaceId, storage = defaultStorage()) {
  if (!storage || !workspaceId) return;
  const legacyKey = `${RECOVERY_PREFIX}${workspaceId}`;
  const sessionPrefix = `${legacyKey}:`;
  try { storage.removeItem(legacyKey); } catch { /* best effort */ }

  if (typeof storage.length === "number" && typeof storage.key === "function") {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(sessionPrefix)) keys.push(key);
    }
    keys.forEach((key) => {
      try { storage.removeItem(key); } catch { /* best effort */ }
    });
    return;
  }

  if (typeof storage.dump === "function") {
    Object.keys(storage.dump()).filter((key) => key.startsWith(sessionPrefix)).forEach((key) => storage.removeItem(key));
  }
}
