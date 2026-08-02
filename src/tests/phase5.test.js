import test from "node:test";
import assert from "node:assert/strict";
import {
  getPageMeta,
  getPlanCompletionLabel,
  getPrimaryDashboardAction,
} from "../lib/uiExperience.js";
import { getLessonMasteryBlockers } from "../lib/resultCoaching.js";

test("page metadata gives every primary route a concise accessible label", () => {
  assert.equal(getPageMeta("/").title, "Today");
  assert.equal(getPageMeta("/learn/home-f-j").title, "Lesson");
  assert.equal(getPageMeta("/settings").title, "Settings");
});

test("dashboard prioritises setup, reviews, lessons, then benchmarks", () => {
  assert.equal(getPrimaryDashboardAction({ onboardingCompleted: false }).kind, "setup");
  assert.equal(getPrimaryDashboardAction({ onboardingCompleted: true, reviewQueue: [{ lessonId: "x", lesson: { title: "Review X" } }] }).kind, "review");
  assert.equal(getPrimaryDashboardAction({ onboardingCompleted: true, nextLesson: { id: "y", number: 2, title: "Lesson Y" } }).kind, "lesson");
  assert.equal(getPrimaryDashboardAction({ onboardingCompleted: true }).kind, "benchmark");
});

test("daily goal labels stay simple and action-oriented", () => {
  assert.equal(getPlanCompletionLabel({ completedMinutes: 4, goalMinutes: 10 }), "6 minutes remaining");
  assert.equal(getPlanCompletionLabel({ completedMinutes: 12, goalMinutes: 10 }), "Daily goal complete");
});

test("single remaining guided exercise uses correct singular guidance", () => {
  const blockers = getLessonMasteryBlockers({
    exerciseResults: {
      first: { passed: true },
      second: { passed: true },
    },
  }, {
    passAccuracy: 94,
    exercises: [{ id: "first" }, { id: "second" }, { id: "third" }],
  });
  assert.equal(blockers[0].detail, "1 exercise still needs a passing result.");
});
