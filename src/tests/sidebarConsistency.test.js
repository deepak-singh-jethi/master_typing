import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("desktop app uses one half-circle course sidebar on every AppShell route", () => {
  const sidebar = source("components/layout/Sidebar.jsx");
  const shell = source("components/layout/AppShell.jsx");

  assert.match(shell, /<Sidebar \/>/);
  assert.match(sidebar, /function CourseArc/);
  assert.match(sidebar, /Course progress/);
  assert.match(sidebar, /View course map/);
  assert.match(sidebar, /Current streak/);
  assert.match(sidebar, /Daily goal/);
  assert.match(sidebar, /Dark mode/);

  // There must not be a route-specific compact sidebar variant anymore.
  assert.doesNotMatch(sidebar, /isFocusedLessonPath/);
  assert.doesNotMatch(sidebar, /focusedLesson\s*\?/);
  assert.doesNotMatch(sidebar, /Open learning path/);
  assert.doesNotMatch(sidebar, /<ProgressBar/);
});

test("lesson routes remain inside the shared AppShell so Learn stays the active navigation section", () => {
  const router = source("app/AppRouter.jsx");
  const navigation = source("components/layout/navigation.js");

  assert.match(router, /path="learn\/:lessonId"/);
  assert.match(navigation, /\{ to: "\/learn", label: "Learn"/);
  assert.doesNotMatch(navigation, /\{ to: "\/learn", label: "Learn"[^\n]*end: true/);
});
