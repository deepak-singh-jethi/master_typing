import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("lesson page puts lesson identity and guided progress before the typing surface", () => {
  const lesson = source("pages/LessonPage.jsx");
  const titleIndex = lesson.indexOf('id="lesson-focus-title"');
  const stepsIndex = lesson.indexOf('{practiceMode === "guided" ? lessonPath');
  const workspaceIndex = lesson.lastIndexOf('layout="lesson-focus"');
  assert.ok(titleIndex >= 0 && stepsIndex > titleIndex && workspaceIndex > stepsIndex);
  assert.match(lesson, /Step \{exerciseIndex \+ 1\} of \{lesson\.exercises\.length\}/);
  assert.match(lesson, /Completed · Replaying/);
  assert.match(lesson, /"Ready"/);
  assert.match(lesson, /"Locked"/);
  assert.match(lesson, /Lesson map/);
});

test("practice modes remain available without taking over the primary lesson hierarchy", () => {
  const lesson = source("pages/LessonPage.jsx");
  assert.match(lesson, /<details className="group relative z-20">/);
  assert.match(lesson, /Practice mode/);
  assert.match(lesson, /Fresh guided text/);
  assert.doesNotMatch(lesson, /Guided lesson path/);
  assert.doesNotMatch(lesson, /Current objective/);
});

test("focused typing workspace makes metrics then typing then keyboard the dominant visual flow", () => {
  const workspace = source("components/typing/TypingWorkspace.jsx");
  const metricIndex = workspace.indexOf('<FocusMetric tone="emerald" label="Accuracy"');
  const typingIndex = workspace.indexOf('aria-label="Typing practice area"');
  const keyboardIndex = workspace.indexOf('variant="lesson-focus"');
  assert.ok(metricIndex >= 0 && typingIndex > metricIndex && keyboardIndex > typingIndex);
  assert.match(workspace, /Keep typing…/);
  assert.match(workspace, /min-h-\[22rem\]/);
  assert.match(workspace, /Keyboard guide/);
  assert.match(workspace, /lessonTip \|\| description/);
});

test("lesson keyboard keeps source focus keys visible while still tracking the next physical key", () => {
  const keyboard = source("components/typing/OnScreenKeyboard.jsx");
  assert.match(keyboard, /focusPhysicalKeys = new Set/);
  assert.match(keyboard, /focus && "border-violet-500\/60 bg-violet-600/);
  assert.match(keyboard, /active && focus && "ring-2/);
  assert.match(keyboard, /label: "Tab"/);
  assert.match(keyboard, /label: "Caps"/);
  assert.match(keyboard, /label: "Enter"/);
  assert.match(keyboard, /label: "Space"/);
});

test("focused lesson routes use the wider distraction-reduced shell", () => {
  const shell = source("components/layout/AppShell.jsx");
  const header = source("components/layout/Header.jsx");
  const sidebar = source("components/layout/Sidebar.jsx");
  assert.match(shell, /max-w-\[1360px\] py-4/);
  assert.match(header, /focusedLesson/);
  assert.match(header, /max-w-\[1360px\]/);
  assert.match(sidebar, /Course progress/);
  assert.match(sidebar, /Current streak/);
  assert.match(sidebar, /Daily goal/);
});

test("guided result screen still prioritises accuracy and gives an explicit next step", () => {
  const lesson = source("pages/LessonPage.jsx");
  const results = source("components/typing/SessionResults.jsx");
  assert.match(lesson, /nextExerciseTitle:/);
  assert.match(lesson, /finalExercise:/);
  assert.match(results, /Lesson \$\{resultContext\.lessonNumber\} · Exercise \$\{guidedStep\} of/);
  assert.match(results, /Your guided path is complete\. Finish the lesson/);
  const guidedMetricStart = results.indexOf("{guidedFlow ? (");
  const accuracy = results.indexOf('label="Accuracy"', guidedMetricStart);
  const wpm = results.indexOf('label="Net WPM"', guidedMetricStart);
  assert.ok(accuracy > guidedMetricStart && wpm > accuracy);
});

test("lesson completion still explains automatic spaced review and forward progression", () => {
  const lesson = source("pages/LessonPage.jsx");
  assert.match(lesson, /Review is handled automatically/);
  assert.match(lesson, /short spaced review when it is actually due/);
  assert.match(lesson, /Continue to lesson \{nextLesson\.number\}/);
  assert.match(lesson, /Your progress is saved and the course can move forward/);
});
