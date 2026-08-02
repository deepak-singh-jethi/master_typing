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
  return {
    key: `${RECOVERY_PREFIX}${workspaceId}`,
    targetHash: hashText(target),
    targetLength: target.length,
    durationSeconds: durationSeconds == null ? null : Number(durationSeconds),
    backspaceMode,
    sessionId: String(sessionId || "session"),
  };
}

function safeClone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function createRecoverySnapshot({ identity, telemetry, elapsedMs = 0, paceSamples = [], status = "paused", savedAt = new Date().toISOString() } = {}) {
  return {
    version: RECOVERY_VERSION,
    ...identity,
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

export function loadRecoverySnapshot(identity, storage = defaultStorage(), now = Date.now()) {
  if (!storage || !identity?.key) return null;
  try {
    const raw = storage.getItem(identity.key);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (!isRecoverySnapshotCompatible(snapshot, identity, now)) {
      storage.removeItem(identity.key);
      return null;
    }
    return snapshot;
  } catch {
    try { storage.removeItem(identity.key); } catch { /* best effort */ }
    return null;
  }
}

export function clearRecoverySnapshot(identity, storage = defaultStorage()) {
  if (!storage || !identity?.key) return;
  try { storage.removeItem(identity.key); } catch { /* best effort */ }
}

export function clearWorkspaceRecovery(workspaceId, storage = defaultStorage()) {
  if (!storage || !workspaceId) return;
  try { storage.removeItem(`${RECOVERY_PREFIX}${workspaceId}`); } catch { /* best effort */ }
}
