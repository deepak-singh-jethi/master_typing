import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAttemptDetail,
  clearAttemptDetails,
  compactAttemptSummary,
  getAttemptDetails,
  getHistoryStats,
  mergeAttemptDetail,
  pruneAttemptDetails,
  saveAttemptDetails,
} from "../lib/historyStore.js";
import {
  compactAppData,
  createFreshAppData,
  DATA_VERSION,
  estimateAppDataBytes,
  getAppStorageKey,
  loadAppData,
  saveAppData,
} from "../lib/storage.js";
import {
  buildRecoveryIdentity,
  createRecoverySnapshot,
  isRecoverySnapshotCompatible,
  loadRecoverySnapshot,
  saveRecoverySnapshot,
} from "../lib/sessionRecovery.js";
import { getTypingWindow } from "../lib/typingWindow.js";
import { enqueueSync, getSyncOutbox, OUTBOX_SESSION_LIMIT } from "../lib/syncStorage.js";
import { applyInputChange, createTypingTelemetry } from "../lib/typingEngine.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values),
  };
}

function fakeIndexedDb() {
  const records = new Map();
  const db = {
    objectStoreNames: { contains: () => false },
    createObjectStore() {
      return { createIndex() {} };
    },
    transaction() {
      let pending = 0;
      const transaction = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: null,
        objectStore() {
          const run = (operation, request = null) => {
            pending += 1;
            queueMicrotask(() => {
              try {
                const result = operation();
                if (request) { request.result = result; request.onsuccess?.(); }
              } catch (error) {
                transaction.error = error;
                request?.onerror?.();
                transaction.onerror?.();
                return;
              }
              pending -= 1;
              if (pending === 0) queueMicrotask(() => transaction.oncomplete?.());
            });
            return request;
          };
          return {
            put(value) { return run(() => records.set(value.storageKey, structuredClone(value))); },
            get(key) { const request = {}; return run(() => structuredClone(records.get(key)), request); },
            getAll() { const request = {}; return run(() => [...records.values()].map((item) => structuredClone(item)), request); },
            delete(key) { return run(() => records.delete(key)); },
          };
        },
      };
      return transaction;
    },
    close() {},
  };
  return {
    open() {
      const request = { result: db, error: null, onerror: null, onupgradeneeded: null, onsuccess: null };
      queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
      return request;
    },
  };
}

function detailedAttempt(id = "attempt-1") {
  return {
    id,
    completedAt: "2026-08-01T10:00:00.000Z",
    type: "practice",
    durationSeconds: 300,
    netWpm: 42.3,
    accuracy: 96.7,
    consistency: 81,
    charactersTyped: 1050,
    correctCharacters: 1015,
    typedText: "detailed text that belongs in IndexedDB",
    targetText: "target text",
    keyStats: { a: { attempts: 12, errors: 1, totalLatencyMs: 2300 } },
    bigramStats: { th: { attempts: 5, errors: 1, totalLatencyMs: 900 } },
    paceSamples: [35, 40, 44],
  };
}

test("compact attempt summaries remove large detailed telemetry", () => {
  const summary = compactAttemptSummary(detailedAttempt());
  assert.equal(summary.id, "attempt-1");
  assert.equal(summary.detailStored, true);
  assert.equal("typedText" in summary, false);
  assert.equal("targetText" in summary, false);
  assert.equal("keyStats" in summary, false);
  assert.equal("bigramStats" in summary, false);
  assert.equal("paceSamples" in summary, false);
});

test("IndexedDB details merge back into compact attempt summaries", () => {
  const attempt = detailedAttempt();
  const summary = compactAttemptSummary(attempt);
  const detail = buildAttemptDetail(attempt, "user-1");
  const merged = mergeAttemptDetail(summary, detail);
  assert.equal(merged.typedText, attempt.typedText);
  assert.equal(merged.keyStats.a.attempts, 12);
  assert.equal(merged.netWpm, 42.3);
});

test("version 8 local data migrates to version 9 compact persistence", () => {
  const storage = memoryStorage();
  const legacy = createFreshAppData();
  legacy.version = 8;
  legacy.attempts = [detailedAttempt("legacy-detail")];
  storage.setItem(getAppStorageKey(null), JSON.stringify(legacy));

  const loaded = loadAppData(null, storage);
  assert.equal(loaded.version, DATA_VERSION);
  assert.equal(loaded.version, 9);
  assert.equal(loaded.attempts.length, 1);
  assert.equal("typedText" in loaded.attempts[0], false);
  assert.equal(loaded.attempts[0].detailStored, true);
});

test("one thousand compact sessions stay within the LocalStorage target", () => {
  const data = createFreshAppData();
  data.attempts = Array.from({ length: 1000 }, (_, index) => ({
    ...detailedAttempt(`attempt-${index}`),
    completedAt: new Date(Date.UTC(2026, 7, 1, 0, 0, index)).toISOString(),
    mistakeWords: [{ expected: "practice", typed: "pratice" }],
    difficultBigrams: [{ key: "th" }],
  }));
  const compact = compactAppData(data);
  assert.equal(compact.attempts.length, 1000);
  assert.ok(estimateAppDataBytes(compact) < 2 * 1024 * 1024);
  assert.equal(compact.attempts.some((item) => "typedText" in item), false);
});

test("saveAppData writes compact summaries instead of detailed attempts", () => {
  const storage = memoryStorage();
  const data = createFreshAppData();
  data.attempts = [detailedAttempt("saved")];
  assert.equal(saveAppData(data, null, storage), true);
  const raw = JSON.parse(storage.getItem(getAppStorageKey(null)));
  assert.equal(raw.version, 9);
  assert.equal(raw.attempts[0].id, "saved");
  assert.equal("typedText" in raw.attempts[0], false);
  assert.equal("keyStats" in raw.attempts[0], false);
});

test("the long-text renderer window remains bounded around the active index", () => {
  const target = Array.from({ length: 3000 }, (_, index) => `word${index}`).join(" ");
  const activeIndex = Math.floor(target.length * 0.62);
  const windowed = getTypingWindow(target, activeIndex, 900);
  assert.ok(windowed.start <= activeIndex);
  assert.ok(windowed.end >= activeIndex);
  assert.ok(windowed.text.length < 2200);
  assert.equal(windowed.text, target.slice(windowed.start, windowed.end));
  assert.ok(windowed.hiddenBefore > 0);
  assert.ok(windowed.hiddenAfter > 0);
});

test("an active session restores its text and telemetry in a paused state", () => {
  const storage = memoryStorage();
  const target = "the quick brown fox jumps over the lazy dog";
  const identity = buildRecoveryIdentity({
    workspaceId: "user:abc",
    target,
    durationSeconds: 300,
    backspaceMode: "allowed",
    sessionId: "practice:adaptive",
  });
  const telemetry = createTypingTelemetry(target);
  applyInputChange(telemetry, "the quick", 1400, { backspaceMode: "allowed" });
  const snapshot = createRecoverySnapshot({
    identity,
    telemetry,
    elapsedMs: 3200,
    paceSamples: [20, 24, 27],
    status: "running",
    savedAt: "2026-08-01T12:00:00.000Z",
  });
  assert.equal(snapshot.status, "paused");
  assert.equal(saveRecoverySnapshot(identity, snapshot, storage), true);
  const restored = loadRecoverySnapshot(identity, storage, Date.parse("2026-08-01T12:05:00.000Z"));
  assert.equal(restored.telemetry.typed, "the quick");
  assert.equal(restored.elapsedMs, 3200);
  assert.equal(restored.status, "paused");
});

test("stale or incompatible recovery snapshots are rejected", () => {
  const target = "safe recovery target";
  const identity = buildRecoveryIdentity({ workspaceId: "guest", target, sessionId: "lesson" });
  const telemetry = createTypingTelemetry(target);
  telemetry.typed = "safe";
  const stale = createRecoverySnapshot({
    identity,
    telemetry,
    elapsedMs: 1000,
    savedAt: "2026-07-20T12:00:00.000Z",
  });
  assert.equal(isRecoverySnapshotCompatible(stale, identity, Date.parse("2026-08-01T12:00:00.000Z")), false);
  const other = buildRecoveryIdentity({ workspaceId: "guest", target: `${target}!`, sessionId: "lesson" });
  assert.equal(isRecoverySnapshotCompatible({ ...stale, savedAt: "2026-08-01T11:59:00.000Z" }, other), false);
});

test("offline outbox compaction retains the newest one thousand unique sessions", () => {
  const storage = memoryStorage();
  const ids = Array.from({ length: 1100 }, (_, index) => `session-${index}`);
  enqueueSync("user-1", { sessionIds: [...ids, "session-1099", "session-1098"], snapshot: true }, storage);
  const outbox = getSyncOutbox("user-1", storage);
  assert.equal(OUTBOX_SESSION_LIMIT, 1000);
  assert.equal(outbox.sessionIds.length, 1000);
  assert.equal(outbox.sessionIds[0], "session-100");
  assert.equal(outbox.sessionIds.at(-1), "session-1099");
  assert.equal(new Set(outbox.sessionIds).size, outbox.sessionIds.length);
});


test("IndexedDB history save, read, prune, and clear operations complete safely", async () => {
  const indexedDB = fakeIndexedDb();
  const attempts = [
    { ...detailedAttempt("old"), completedAt: "2026-08-01T08:00:00.000Z" },
    { ...detailedAttempt("middle"), completedAt: "2026-08-01T09:00:00.000Z" },
    { ...detailedAttempt("new"), completedAt: "2026-08-01T10:00:00.000Z" },
  ];
  assert.equal(await saveAttemptDetails("user-1", attempts, { indexedDB }), 3);
  const details = await getAttemptDetails("user-1", ["old", "new"], { indexedDB });
  assert.equal(details.get("old").typedText, attempts[0].typedText);
  assert.equal(details.get("new").id, "new");
  assert.equal((await getHistoryStats("user-1", { indexedDB })).detailCount, 3);
  const pruned = await pruneAttemptDetails("user-1", { keep: 1, protectedIds: ["old"], indexedDB });
  assert.deepEqual(pruned, { removed: 1, remaining: 2 });
  assert.equal((await getHistoryStats("user-1", { indexedDB })).detailCount, 2);
  assert.equal(await clearAttemptDetails("user-1", { indexedDB }), 2);
  assert.equal((await getHistoryStats("user-1", { indexedDB })).detailCount, 0);
});
