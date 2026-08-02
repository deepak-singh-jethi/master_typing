import test from "node:test";
import assert from "node:assert/strict";
import {
  hasMeaningfulLocalProgress,
  mergeCloudIntoLocal,
  normaliseTimingStatsForCloud,
  toProfileRow,
  toSessionPayload,
  toSettingsRow,
} from "../lib/cloudSync.js";
import { createFreshAppData } from "../lib/storage.js";

test("empty guest data is not treated as progress", () => {
  assert.equal(hasMeaningfulLocalProgress(createFreshAppData()), false);
});

test("completed guest sessions are eligible for account migration", () => {
  const data = createFreshAppData();
  data.progress.totalSessions = 1;
  assert.equal(hasMeaningfulLocalProgress(data), true);
});

test("profile and settings map client values to database constraints", () => {
  const data = createFreshAppData();
  data.profile.name = "Deepak";
  data.profile.experience = "hunt-and-peck";
  data.profile.primaryGoal = "work";
  data.settings.backspaceMode = "errors-only";
  data.settings.dailyGoalMinutes = 20;

  assert.deepEqual(toProfileRow("user-1", data), {
    user_id: "user-1",
    display_name: "Deepak",
    onboarding_completed: false,
    skill_stage: "hunt_and_peck",
    typing_goal: "practical",
    daily_goal_minutes: 20,
  });
  assert.equal(toSettingsRow("user-1", data).backspace_mode, "errors_only");
});

test("session payload is compact and excludes typed text", () => {
  const payload = toSessionPayload({
    id: "attempt-1",
    type: "practice",
    contentType: "words",
    practiceMode: "adaptive",
    modeId: "smart-review",
    goalType: "time",
    wordCount: 240,
    plannedDurationSeconds: 300,
    exerciseId: "home-row-full-2",
    exerciseTitle: "Whole home row transfer",
    practicePurpose: "adaptive",
    durationSeconds: 60,
    netWpm: 40,
    rawWpm: 44,
    accuracy: 96,
    finalTextAccuracy: 98,
    charactersTyped: 200,
    correctCharacters: 190,
    errors: 8,
    correctedErrors: 6,
    typedText: "this must stay local",
    difficultBigrams: [{ key: "th" }],
    mistakeWords: [{ expected: "their", typed: "thier" }],
    completedAt: "2026-08-01T10:00:00.000Z",
  });

  assert.equal(payload.client_session_id, "attempt-1");
  assert.equal(payload.gross_wpm, 44);
  assert.deepEqual(payload.difficult_bigrams, ["th"]);
  assert.deepEqual(payload.mistake_words, ["their"]);
  assert.equal(payload.metadata.goalType, "time");
  assert.equal(payload.metadata.wordCount, 240);
  assert.equal(payload.metadata.plannedDurationSeconds, 300);
  assert.equal(payload.metadata.exerciseId, "home-row-full-2");
  assert.equal(payload.metadata.modeId, "smart-review");
  assert.equal("typedText" in payload, false);
  assert.equal(JSON.stringify(payload).includes("this must stay local"), false);
});

test("cloud merge restores account progress without discarding detailed local attempts", () => {
  const local = createFreshAppData();
  local.attempts = [{
    id: "attempt-1",
    completedAt: "2026-08-01T10:00:00.000Z",
    typedText: "detailed local text",
    netWpm: 30,
  }];

  const merged = mergeCloudIntoLocal(local, {
    profile: {
      display_name: "Cloud Learner",
      skill_stage: "touch_typist",
      typing_goal: "speed",
      daily_goal_minutes: 15,
      created_at: "2026-08-01T09:00:00.000Z",
    },
    settings: {
      theme: "dark",
      keyboard_visible: false,
      backspace_mode: "errors_only",
      sound_enabled: true,
      text_size: "large",
      preferences: { showLiveWpm: false },
    },
    progress: {
      data_version: 7,
      active_course_id: "touch-typing-path",
      active_lesson_id: "home-a-semicolon",
      completed_lessons: ["home-f-j"],
      total_practice_seconds: 600,
      total_sessions: 5,
      total_characters: 1000,
      total_correct_characters: 950,
      best_wpm: 52,
      average_wpm: 38,
      average_accuracy: 96,
      average_consistency: 80,
      current_streak: 3,
      longest_streak: 4,
      last_practice_date: "2026-08-01",
      onboarding: { completed: true },
      adaptive: {},
      personal_bests: {},
      last_practice_config: {},
      saved_custom_texts: [],
      practice_content_history: [],
    },
    mastery: [{
      lesson_id: "home-f-j",
      status: "mastered",
      mastery_score: 90,
      passed_exercises: ["home-f-j-1"],
      attempt_count: 3,
      best_accuracy: 99,
      best_wpm: 30,
      review_interval_days: 3,
      review_count: 0,
      metadata: {},
      updated_at: "2026-08-01T10:01:00.000Z",
    }],
    sessions: [{
      client_session_id: "attempt-1",
      completed_at: "2026-08-01T10:00:00.000Z",
      mode: "practice",
      duration_seconds: 60,
      active_duration_seconds: 60,
      net_wpm: 35,
      gross_wpm: 40,
      keystroke_accuracy: 96,
      final_text_accuracy: 98,
      consistency: 80,
      burst_wpm: 50,
      correction_rate: 75,
      typed_characters: 200,
      correct_characters: 190,
      error_count: 8,
      corrected_errors: 6,
      valid_benchmark: false,
      personal_best_eligible: false,
      focus_keys: [],
      difficult_bigrams: [],
      mistake_words: [],
      metadata: {},
    }],
    dailyActivity: [],
    skills: [],
  });

  assert.equal(merged.profile.name, "Cloud Learner");
  assert.equal(merged.settings.backspaceMode, "errors-only");
  assert.equal(merged.progress.totalSessions, 5);
  assert.equal(merged.progress.lessonMastery["home-f-j"].state, "mastered");
  assert.equal(merged.attempts.length, 1);
  assert.equal(merged.attempts[0].typedText, "detailed local text");
});


test("cloud timing telemetry rounds browser decimals to database-safe integers", () => {
  const stats = normaliseTimingStatsForCloud({
    a: {
      attempts: 3,
      correct: 2,
      errors: 1,
      correctedErrors: 1,
      timedAttempts: 3,
      totalLatencyMs: 1483.2999997138977,
      fastestMs: 221.5999999,
      slowestMs: 812.5000001,
      confusions: { s: 1.2, d: 0 },
    },
  });

  assert.equal(stats.a.totalLatencyMs, 1483);
  assert.equal(stats.a.fastestMs, 222);
  assert.equal(stats.a.slowestMs, 813);
  assert.deepEqual(stats.a.confusions, { s: 1 });
});
