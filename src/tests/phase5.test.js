import test from "node:test";
import assert from "node:assert/strict";
import {
  getDashboardReviewAction,
  getPageMeta,
  getPlanCompletionLabel,
  getPrimaryDashboardAction,
} from "../lib/uiExperience.js";
import { getLessonMasteryBlockers } from "../lib/resultCoaching.js";

test("page metadata gives every primary route a concise accessible label", () => {
  assert.equal(getPageMeta("/").title, "Today");
  assert.equal(getPageMeta("/learn/home-f-j").title, "Lesson");
  assert.equal(getPageMeta("/review/home-f-j").title, "Spaced review");
  assert.equal(getPageMeta("/settings").title, "Settings");
});

test("dashboard keeps course progression primary after setup", () => {
  assert.equal(getPrimaryDashboardAction({ onboardingCompleted: false }).kind, "setup");
  assert.equal(getPrimaryDashboardAction({
    onboardingCompleted: true,
    nextLesson: { id: "y", number: 2, title: "Lesson Y" },
  }).kind, "lesson");
  assert.equal(getPrimaryDashboardAction({ onboardingCompleted: true }).kind, "benchmark");
});

test("a due review stays independently visible without replacing the current lesson", () => {
  const lessonAction = getPrimaryDashboardAction({
    onboardingCompleted: true,
    nextLesson: { id: "top-r-u", number: 8, title: "R and U" },
  });
  const reviewAction = getDashboardReviewAction([
    {
      lessonId: "home-f-j",
      lesson: { title: "F and J anchors" },
      mastery: { dueAt: "2026-08-14T10:00:00.000Z" },
    },
    { lessonId: "home-d-k", lesson: { title: "D and K" }, mastery: {} },
  ]);

  assert.equal(lessonAction.kind, "lesson");
  assert.equal(lessonAction.title, "R and U");
  assert.equal(lessonAction.to, "/learn/top-r-u");

  assert.equal(reviewAction.kind, "review");
  assert.equal(reviewAction.title, "F and J anchors");
  assert.equal(reviewAction.label, "Start review");
  assert.equal(reviewAction.to, "/review/home-f-j");
  assert.equal(reviewAction.dueCount, 2);
});

test("dashboard review action disappears cleanly when no review is due", () => {
  assert.equal(getDashboardReviewAction([]), null);
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
