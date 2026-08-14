const LESSON_SESSION_SEED_PREFIX = "typing-master:lesson-session-seed:";

function defaultStorage() {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function safePart(value) {
  return encodeURIComponent(String(value || "unknown")).slice(0, 120);
}

export function getLessonSessionSeedKey({ workspaceId = "guest", lessonId, exerciseId } = {}) {
  return `${LESSON_SESSION_SEED_PREFIX}${safePart(workspaceId)}:${safePart(lessonId)}:${safePart(exerciseId)}`;
}

export function getOrCreateLessonSessionSeed(identity = {}, storage = defaultStorage(), fallbackSeed = Date.now()) {
  const key = getLessonSessionSeedKey(identity);
  if (storage) {
    try {
      const stored = Number(storage.getItem(key));
      if (Number.isSafeInteger(stored) && stored > 0) return stored;
    } catch {
      // Storage is optional; fall back to an in-memory seed for this mount.
    }
  }

  const seed = Math.max(1, Math.floor(Number(fallbackSeed) || Date.now()));
  if (storage) {
    try { storage.setItem(key, String(seed)); } catch { /* best effort */ }
  }
  return seed;
}

export function setLessonSessionSeed(identity = {}, seed = Date.now(), storage = defaultStorage()) {
  const nextSeed = Math.max(1, Math.floor(Number(seed) || Date.now()));
  if (storage) {
    try { storage.setItem(getLessonSessionSeedKey(identity), String(nextSeed)); } catch { /* best effort */ }
  }
  return nextSeed;
}

export function clearLessonSessionSeeds(workspaceId, storage = defaultStorage()) {
  if (!storage || !workspaceId) return;
  const prefix = `${LESSON_SESSION_SEED_PREFIX}${safePart(workspaceId)}:`;

  if (typeof storage.length === "number" && typeof storage.key === "function") {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => {
      try { storage.removeItem(key); } catch { /* best effort */ }
    });
    return;
  }

  if (typeof storage.dump === "function") {
    Object.keys(storage.dump()).filter((key) => key.startsWith(prefix)).forEach((key) => storage.removeItem(key));
  }
}
