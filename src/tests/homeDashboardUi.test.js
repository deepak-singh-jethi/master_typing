import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../pages/DashboardPage.jsx", import.meta.url), "utf8");

test("Home keeps the current course action visually primary while reviews stay independently accessible", () => {
  assert.match(source, /getPrimaryDashboardAction\(\{\s*onboardingCompleted: data\.onboarding\.completed,\s*reviewQueue: \[\],\s*nextLesson,/s);
  assert.match(source, /Continue learning/);
  assert.match(source, /Start review/);
  assert.match(source, /to=\{`\/review\/\$\{review\.lessonId\}`\}/);
});

test("Home exposes one clear lesson entry plus three secondary quick actions", () => {
  assert.match(source, /\{action\.label\}/);
  assert.match(source, /Lesson map/);
  assert.match(source, /Smart practice/);
  assert.match(source, /Take a test/);
  assert.match(source, /Browse course/);
  assert.doesNotMatch(source, /Choose a route/);
  assert.doesNotMatch(source, /What do you want to do\?/);
});

test("Home keeps glance metrics but omits the streak calendar, rejected activity chart and motivational strip", () => {
  assert.match(source, /Today at a glance/);
  assert.doesNotMatch(source, /Streak calendar/);
  assert.doesNotMatch(source, /Daily goal 15 min/);
  assert.doesNotMatch(source, /Small daily progress leads to big improvement/);
});

test("Home has explicit states for due and caught-up reviews", () => {
  assert.match(source, /Review due/);
  assert.match(source, /No review due/);
  assert.match(source, /Caught up/);
  assert.match(source, /Reviews support your course progress; they do not replace your current lesson/);
});
