import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  getDashboardReviewAction,
  getPrimaryDashboardAction,
} from "../lib/uiExperience.js";

const here = dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(resolve(here, "../pages/DashboardPage.jsx"), "utf8");

test("Home keeps the active lesson primary even when a spaced review is due", () => {
  const action = getPrimaryDashboardAction({
    onboardingCompleted: true,
    reviewQueue: [{ lessonId: "home-s-l", lesson: { title: "S and L" } }],
    nextLesson: { id: "top-r-u", number: 8, title: "R and U", subtitle: "Index fingers reach upward" },
  });

  assert.equal(action.kind, "lesson");
  assert.equal(action.to, "/learn/top-r-u");
  assert.equal(action.title, "R and U");
});

test("Home exposes due spaced review as a separate maintenance action", () => {
  const action = getDashboardReviewAction([
    { lessonId: "home-s-l", lesson: { title: "S and L" }, mastery: { dueAt: "2026-08-14T10:00:00.000Z" } },
  ]);

  assert.equal(action.kind, "review");
  assert.equal(action.to, "/review/home-s-l");
  assert.equal(action.label, "Start review");
  assert.equal(action.dueCount, 1);
});

test("Home source presents course before review and removes the duplicate continue-learning route card", () => {
  const courseIndex = dashboardSource.indexOf("<CourseHero");
  const reviewIndex = dashboardSource.indexOf("<ReviewPanel");

  assert.ok(courseIndex >= 0);
  assert.ok(reviewIndex > courseIndex);
  assert.doesNotMatch(dashboardSource, /title="Continue learning"/);
  assert.doesNotMatch(dashboardSource, /Choose a route/);
  assert.match(dashboardSource, /More ways to practice/);
});

test("Home explicitly explains that review maintenance does not replace the course lesson", () => {
  assert.match(dashboardSource, /does not replace or move your current course lesson/);
  assert.match(dashboardSource, /Your main learning path/);
});
