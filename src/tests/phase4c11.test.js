import test from "node:test";
import assert from "node:assert/strict";
import {
  createFreshAppData,
  getAppStorageKey,
  GUEST_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  loadAppData,
  saveAppData,
} from "../lib/storage.js";
import {
  enqueueSync,
  getSyncOutbox,
  markSyncFailure,
  markSyncSuccess,
} from "../lib/syncStorage.js";
import {
  mergeAccountLocalData,
  mergeCloudIntoLocal,
  mergeGuestIntoAccount,
} from "../lib/cloudSync.js";
import { lessons } from "../data/curriculum.js";
import { generatePracticeText } from "../data/contentBank.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    dump: () => Object.fromEntries(values),
  };
}

function attempt(id, completedAt = "2026-08-01T10:00:00.000Z") {
  return {
    id,
    type: "practice",
    completedAt,
    durationSeconds: 60,
    netWpm: 30,
    accuracy: 96,
    charactersTyped: 150,
    correctCharacters: 145,
  };
}

test("legacy shared progress migrates once into the guest workspace", () => {
  const storage = memoryStorage();
  const legacy = createFreshAppData();
  legacy.profile.name = "Legacy learner";
  legacy.progress.totalSessions = 2;
  storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));

  const guest = loadAppData(null, storage);
  assert.equal(guest.profile.name, "Legacy learner");
  assert.equal(guest.progress.totalSessions, 2);
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), null);
  assert.ok(storage.getItem(GUEST_STORAGE_KEY));
});

test("guest, Account A, and Account B use isolated local caches", () => {
  const storage = memoryStorage();
  const guest = createFreshAppData();
  guest.profile.name = "Guest";
  const accountA = createFreshAppData();
  accountA.profile.name = "Account A";
  const accountB = createFreshAppData();
  accountB.profile.name = "Account B";

  saveAppData(guest, null, storage);
  saveAppData(accountA, "user-a", storage);
  saveAppData(accountB, "user-b", storage);

  assert.equal(loadAppData(null, storage).profile.name, "Guest");
  assert.equal(loadAppData("user-a", storage).profile.name, "Account A");
  assert.equal(loadAppData("user-b", storage).profile.name, "Account B");
  assert.notEqual(getAppStorageKey("user-a"), getAppStorageKey("user-b"));
});

test("sync outboxes are isolated between accounts", () => {
  const storage = memoryStorage();
  enqueueSync("user-a", { sessionIds: ["a1"], snapshot: true }, storage);
  enqueueSync("user-b", { sessionIds: ["b1"], snapshot: true }, storage);
  assert.deepEqual(getSyncOutbox("user-a", storage).sessionIds, ["a1"]);
  assert.deepEqual(getSyncOutbox("user-b", storage).sessionIds, ["b1"]);
});

test("persistent sync outbox deduplicates sessions and clears only successful items", () => {
  const storage = memoryStorage();
  enqueueSync("user-a", { sessionIds: ["s1", "s1", "s2"], snapshot: true }, storage);
  enqueueSync("user-a", { sessionIds: ["s2", "s3"], snapshot: true }, storage);
  assert.deepEqual(getSyncOutbox("user-a", storage).sessionIds, ["s1", "s2", "s3"]);

  const failed = markSyncFailure("user-a", storage, Date.parse("2026-08-01T10:00:00.000Z"));
  assert.equal(failed.retryCount, 1);
  assert.ok(failed.nextRetryAt);

  const remaining = markSyncSuccess("user-a", { sessionIds: ["s1", "s3"] }, storage);
  assert.deepEqual(remaining.sessionIds, ["s2"]);
  assert.equal(remaining.snapshotPending, false);
  assert.equal(remaining.retryCount, 0);
});

test("a completed sync cannot clear a newer automatic snapshot", () => {
  const storage = memoryStorage();
  const first = enqueueSync("user-a", { snapshot: true, snapshotRevision: 100 }, storage);
  const newer = enqueueSync("user-a", { snapshot: true, snapshotRevision: 200 }, storage);

  const stillPending = markSyncSuccess("user-a", {
    snapshotRevision: first.snapshotRevision,
  }, storage);
  assert.equal(stillPending.snapshotPending, true);
  assert.equal(stillPending.snapshotRevision, newer.snapshotRevision);

  const cleared = markSyncSuccess("user-a", {
    snapshotRevision: newer.snapshotRevision,
  }, storage);
  assert.equal(cleared.snapshotPending, false);
});

test("cloud pull unions compact cloud sessions with unsynced detailed local attempts", () => {
  const local = createFreshAppData();
  local.attempts = [
    { ...attempt("local-only"), typedText: "local detail" },
    { ...attempt("shared"), typedText: "shared detail" },
  ];
  local.progress.totalSessions = 2;

  const merged = mergeCloudIntoLocal(local, {
    profile: { display_name: "Cloud user", skill_stage: "beginner", typing_goal: "accuracy" },
    settings: {},
    progress: {
      data_version: 8,
      active_course_id: "touch-typing-path",
      active_lesson_id: "home-f-j",
      completed_lessons: [],
      total_practice_seconds: 120,
      total_sessions: 2,
      total_characters: 300,
      total_correct_characters: 290,
      best_wpm: 31,
      average_wpm: 30,
      average_accuracy: 96,
      average_consistency: 80,
      current_streak: 1,
      longest_streak: 1,
      onboarding: {},
      adaptive: {},
      personal_bests: {},
      last_practice_config: {},
      saved_custom_texts: [],
      practice_content_history: [],
    },
    mastery: [
      {
        lesson_id: "home-f-j",
        status: "practising",
        mastery_score: 72,
        passed_exercises: ["home-f-j-1", "home-f-j-2"],
        attempt_count: 2,
        best_accuracy: 97,
        best_wpm: 24,
        metadata: {},
      },
    ],
    sessions: [
      {
        client_session_id: "shared",
        completed_at: "2026-08-01T10:00:00.000Z",
        mode: "practice",
        duration_seconds: 60,
        active_duration_seconds: 60,
        net_wpm: 35,
        gross_wpm: 37,
        keystroke_accuracy: 96,
        final_text_accuracy: 98,
        consistency: 82,
        burst_wpm: 45,
        correction_rate: 70,
        typed_characters: 150,
        correct_characters: 145,
        error_count: 5,
        corrected_errors: 4,
        focus_keys: [],
        difficult_bigrams: [],
        mistake_words: [],
        metadata: {},
      },
      {
        client_session_id: "cloud-only",
        completed_at: "2026-08-01T09:00:00.000Z",
        mode: "practice",
        duration_seconds: 60,
        active_duration_seconds: 60,
        net_wpm: 29,
        gross_wpm: 31,
        keystroke_accuracy: 95,
        final_text_accuracy: 96,
        consistency: 78,
        burst_wpm: 40,
        correction_rate: 60,
        typed_characters: 145,
        correct_characters: 139,
        error_count: 6,
        corrected_errors: 4,
        focus_keys: [],
        difficult_bigrams: [],
        mistake_words: [],
        metadata: {},
      },
    ],
    dailyActivity: [],
    skills: [],
  });

  assert.deepEqual(new Set(merged.attempts.map((item) => item.id)), new Set(["local-only", "shared", "cloud-only"]));
  assert.equal(merged.attempts.find((item) => item.id === "shared").typedText, "shared detail");
  assert.deepEqual(
    merged.progress.lessonMastery["home-f-j"].passedExerciseIds,
    ["home-f-j-1", "home-f-j-2"],
  );
});

test("practice completed during the initial cloud pull is preserved", () => {
  const cloudBase = createFreshAppData();
  cloudBase.progress.totalSessions = 3;
  cloudBase.progress.totalPracticeSeconds = 180;
  cloudBase.attempts = [attempt("cloud-old")];
  cloudBase.progress.lessonMastery["home-f-j"] = {
    state: "practising",
    passedExerciseIds: ["home-f-j-1"],
    attemptCount: 1,
    masteryScore: 40,
  };

  const latestLocal = structuredClone(cloudBase);
  latestLocal.progress.totalSessions = 4;
  latestLocal.progress.totalPracticeSeconds = 240;
  latestLocal.attempts = [attempt("during-pull", "2026-08-01T12:00:00.000Z"), ...cloudBase.attempts];
  latestLocal.progress.lessonMastery["home-f-j"] = {
    state: "practising",
    passedExerciseIds: ["home-f-j-1", "home-f-j-2"],
    attemptCount: 2,
    masteryScore: 70,
  };

  const merged = mergeAccountLocalData(cloudBase, latestLocal);
  assert.deepEqual(new Set(merged.attempts.map((item) => item.id)), new Set(["cloud-old", "during-pull"]));
  assert.equal(merged.progress.totalSessions, 4);
  assert.deepEqual(
    new Set(merged.progress.lessonMastery["home-f-j"].passedExerciseIds),
    new Set(["home-f-j-1", "home-f-j-2"]),
  );
});

test("equal-count sessions from two devices are counted as distinct progress", () => {
  const cloudBase = createFreshAppData();
  cloudBase.progress.totalSessions = 1;
  cloudBase.progress.totalPracticeSeconds = 60;
  cloudBase.progress.totalCharacters = 150;
  cloudBase.progress.totalCorrectCharacters = 145;
  cloudBase.progress.averageWpm = 30;
  cloudBase.progress.averageAccuracy = 96;
  cloudBase.attempts = [attempt("cloud-session")];

  const offlineDevice = createFreshAppData();
  offlineDevice.progress.totalSessions = 1;
  offlineDevice.progress.totalPracticeSeconds = 60;
  offlineDevice.progress.totalCharacters = 150;
  offlineDevice.progress.totalCorrectCharacters = 145;
  offlineDevice.progress.averageWpm = 30;
  offlineDevice.progress.averageAccuracy = 96;
  offlineDevice.attempts = [attempt("offline-session", "2026-08-01T12:00:00.000Z")];

  const merged = mergeAccountLocalData(cloudBase, offlineDevice, {
    preferLatestSnapshot: true,
    additiveSessionIds: ["offline-session"],
  });

  assert.equal(merged.progress.totalSessions, 2);
  assert.equal(merged.progress.totalPracticeSeconds, 120);
  assert.equal(merged.progress.totalCharacters, 300);
  assert.equal(merged.progress.totalCorrectCharacters, 290);
  assert.deepEqual(new Set(merged.attempts.map((item) => item.id)), new Set(["cloud-session", "offline-session"]));
});

test("a pending session already present in the cloud is not counted twice", () => {
  const local = createFreshAppData();
  local.progress.totalSessions = 1;
  local.progress.totalPracticeSeconds = 60;
  local.progress.totalCharacters = 150;
  local.progress.totalCorrectCharacters = 145;
  local.progress.averageWpm = 30;
  local.progress.averageAccuracy = 96;
  local.attempts = [attempt("already-synced")];

  const merged = mergeCloudIntoLocal(local, {
    profile: null,
    settings: null,
    progress: {
      data_version: 9,
      completed_lessons: [],
      total_practice_seconds: 60,
      total_sessions: 1,
      total_characters: 150,
      total_correct_characters: 145,
      best_wpm: 30,
      average_wpm: 30,
      average_accuracy: 96,
      average_consistency: 0,
      current_streak: 1,
      longest_streak: 1,
      onboarding: {},
      adaptive: {},
      personal_bests: {},
      last_practice_config: {},
      saved_custom_texts: [],
      practice_content_history: [],
    },
    mastery: [],
    sessions: [{
      client_session_id: "already-synced",
      completed_at: "2026-08-01T10:00:00.000Z",
      mode: "practice",
      duration_seconds: 60,
      net_wpm: 30,
      keystroke_accuracy: 96,
      typed_characters: 150,
      correct_characters: 145,
      metadata: {},
    }],
    dailyActivity: [],
    skills: [],
  }, { pendingSessionIds: ["already-synced"] });

  assert.equal(merged.progress.totalSessions, 1);
  assert.equal(merged.progress.totalPracticeSeconds, 60);
});

test("pending local preferences win without discarding newer cloud session totals", () => {
  const cloudBase = createFreshAppData();
  cloudBase.progress.totalSessions = 12;
  cloudBase.settings.theme = "dark";
  cloudBase.lastPracticeConfig.durationSeconds = 600;

  const pendingLocal = createFreshAppData();
  pendingLocal.progress.totalSessions = 8;
  pendingLocal.settings.theme = "light";
  pendingLocal.lastPracticeConfig.durationSeconds = 180;

  const merged = mergeAccountLocalData(cloudBase, pendingLocal, { preferLatestSnapshot: true });
  assert.equal(merged.progress.totalSessions, 12);
  assert.equal(merged.settings.theme, "light");
  assert.equal(merged.lastPracticeConfig.durationSeconds, 180);
});

test("cross-device lesson merge keeps passed exercise evidence from both devices", () => {
  const first = createFreshAppData();
  first.progress.lessonMastery["home-f-j"] = {
    state: "practising",
    attempts: 1,
    successfulAttempts: 1,
    passedExerciseIds: ["anchors"],
    exerciseResults: {
      anchors: { attempts: 1, passed: true, bestAccuracy: 97, lastPassedAt: "2026-08-01T09:00:00.000Z" },
    },
  };
  const second = createFreshAppData();
  second.progress.lessonMastery["home-f-j"] = {
    state: "practising",
    attempts: 1,
    successfulAttempts: 1,
    passedExerciseIds: ["reach"],
    exerciseResults: {
      reach: { attempts: 1, passed: true, bestAccuracy: 98, lastPassedAt: "2026-08-01T09:01:00.000Z" },
    },
  };

  const mastery = mergeAccountLocalData(first, second).progress.lessonMastery["home-f-j"];
  assert.deepEqual(new Set(mastery.passedExerciseIds), new Set(["anchors", "reach"]));
  assert.equal(mastery.exerciseResults.anchors.passed, true);
  assert.equal(mastery.exerciseResults.reach.passed, true);
  assert.equal(mastery.successfulAttempts, 2);
});

test("a completed newer review is not reverted by a stale review-due device", () => {
  const completedReview = createFreshAppData();
  completedReview.progress.lessonMastery["home-f-j"] = {
    state: "mastered",
    masteredAt: "2026-07-20T00:00:00.000Z",
    reviewCount: 2,
    reviewIntervalDays: 14,
    dueAt: "2026-08-15T00:00:00.000Z",
    lastPractisedAt: "2026-08-01T10:00:00.000Z",
    reviewExerciseResults: {},
  };
  const staleDevice = createFreshAppData();
  staleDevice.progress.lessonMastery["home-f-j"] = {
    state: "review-due",
    masteredAt: "2026-07-20T00:00:00.000Z",
    reviewCount: 1,
    reviewIntervalDays: 7,
    dueAt: "2026-08-01T00:00:00.000Z",
    lastPractisedAt: "2026-07-28T10:00:00.000Z",
    reviewExerciseResults: { anchors: { attempts: 1, passed: true } },
  };

  const mastery = mergeAccountLocalData(completedReview, staleDevice).progress.lessonMastery["home-f-j"];
  assert.equal(mastery.state, "mastered");
  assert.equal(mastery.reviewCount, 2);
  assert.equal(mastery.reviewIntervalDays, 14);
  assert.equal(mastery.dueAt, "2026-08-15T00:00:00.000Z");
  assert.deepEqual(mastery.reviewExerciseResults, {});
});

test("guest migration adds distinct progress once without dropping account history", () => {
  const account = createFreshAppData();
  account.progress.totalSessions = 2;
  account.progress.totalPracticeSeconds = 120;
  account.attempts = [attempt("account-1")];
  account.statistics.keyStats.f = { attempts: 10, correct: 9, errors: 1 };

  const guest = createFreshAppData();
  guest.progress.totalSessions = 1;
  guest.progress.totalPracticeSeconds = 60;
  guest.attempts = [attempt("guest-1", "2026-08-01T11:00:00.000Z")];
  guest.statistics.keyStats.f = { attempts: 5, correct: 4, errors: 1 };

  const merged = mergeGuestIntoAccount(account, guest);
  assert.equal(merged.progress.totalSessions, 3);
  assert.equal(merged.progress.totalPracticeSeconds, 180);
  assert.deepEqual(new Set(merged.attempts.map((item) => item.id)), new Set(["account-1", "guest-1"]));
  assert.equal(merged.statistics.keyStats.f.attempts, 15);
  assert.equal(merged.statistics.keyStats.f.errors, 2);
});

test("first account migration preserves guest settings and a non-default account name", () => {
  const account = createFreshAppData();
  account.profile.name = "Deepak";
  const guest = createFreshAppData();
  guest.onboarding.completed = true;
  guest.profile.name = "Guest learner";
  guest.settings.theme = "dark";
  guest.settings.dailyGoalMinutes = 20;

  const merged = mergeGuestIntoAccount(account, guest);
  assert.equal(merged.profile.name, "Deepak");
  assert.equal(merged.settings.theme, "dark");
  assert.equal(merged.settings.dailyGoalMinutes, 20);
});

test("every literal focus key receives meaningful coverage in guided exercises", () => {
  for (const lesson of lessons) {
    const focus = lesson.focusKeys
      .map((key) => key === "Space" ? " " : String(key))
      .filter((key) => key.length === 1 && key !== " ");
    const text = lesson.exercises.map((exercise) => exercise.target).join(" ").toLowerCase();
    for (const key of focus) {
      const count = [...text].filter((character) => character === key.toLowerCase()).length;
      assert.ok(count >= 3, `${lesson.id} uses focus key ${JSON.stringify(key)} only ${count} times in guided exercises`);
    }
  }
});

test("guided multi-key lessons keep focus-key coverage reasonably balanced", () => {
  for (const lesson of lessons) {
    const focus = lesson.focusKeys
      .map((key) => key === "Space" ? " " : String(key))
      .filter((key) => key.length === 1 && key !== " ");
    if (focus.length < 2) continue;
    const text = lesson.exercises.map((exercise) => exercise.target).join(" ").toLowerCase();
    const counts = focus.map((key) => [...text].filter((character) => character === key.toLowerCase()).length);
    const minimum = Math.min(...counts);
    const maximum = Math.max(...counts);
    assert.ok(
      minimum / Math.max(1, maximum) >= 0.25,
      `${lesson.id} has unbalanced guided coverage: ${focus.map((key, index) => `${key}:${counts[index]}`).join(", ")}`,
    );
  }
});

test("multi-character focus patterns are practised repeatedly", () => {
  for (const lesson of lessons) {
    const patterns = lesson.focusKeys
      .map(String)
      .filter((key) => key.length > 1 && !["Space", "Shift"].includes(key));
    if (!patterns.length) continue;
    const text = lesson.exercises.map((exercise) => exercise.target).join(" ").toLowerCase();
    for (const pattern of patterns) {
      const count = text.split(pattern.toLowerCase()).length - 1;
      assert.ok(count >= 2, `${lesson.id} uses focus pattern ${pattern} only ${count} times`);
    }
  }
});

test("longer lesson practice balances every literal focus key and never introduces future keys", () => {
  for (const lesson of lessons) {
    const focus = lesson.focusKeys
      .map((key) => key === "Space" ? " " : String(key))
      .filter((key) => key.length === 1 && key !== " ");
    for (const seed of [11, 42, 91]) {
      const text = generatePracticeText({
        contentType: "lesson",
        lessonId: lesson.id,
        goalType: "words",
        wordCount: 200,
        seed,
      });
      for (const character of text) {
        assert.ok(lesson.allowedCharacters.includes(character), `${lesson.id} generated unlearned character ${JSON.stringify(character)}`);
      }
      const lower = text.toLowerCase();
      for (const key of focus) {
        const count = [...lower].filter((character) => character === key.toLowerCase()).length;
        assert.ok(count >= 3, `${lesson.id} generated focus key ${JSON.stringify(key)} only ${count} times for seed ${seed}`);
      }
    }
  }
});

test("whole home-row practice gives g, h, j, and semicolon repeated exposure", () => {
  const text = generatePracticeText({
    contentType: "lesson",
    lessonId: "home-row-fluency",
    goalType: "words",
    wordCount: 200,
    seed: 2026,
  }).toLowerCase();
  for (const key of ["g", "h", "j", ";"]) {
    const count = [...text].filter((character) => character === key).length;
    assert.ok(count >= 8, `home-row fluency uses ${key} only ${count} times`);
  }
});

test("password-recovery URLs are recognised before HashRouter takes control", async () => {
  const { getPasswordResetRedirect, hasPasswordRecoveryParams } = await import("../lib/authUrls.js");
  assert.equal(hasPasswordRecoveryParams({ hash: "#access_token=abc&type=recovery", search: "" }), true);
  assert.equal(hasPasswordRecoveryParams({ hash: "#/reset-password", search: "" }), false);
  assert.equal(hasPasswordRecoveryParams({ hash: "", search: "?type=recovery&code=abc" }), true);
  assert.equal(
    getPasswordResetRedirect({ origin: "https://typing.example.com/", pathname: "/app/" }),
    "https://typing.example.com/app/",
  );
});
