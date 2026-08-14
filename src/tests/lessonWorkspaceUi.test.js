import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("lesson workspace establishes context, guided path, then typing controls in that order", () => {
  const lesson = source("pages/LessonPage.jsx");
  assert.match(lesson, /Lesson \{lesson\.number\}/);
  assert.match(lesson, /const sessionControls = practiceMode === "guided" \? \([\s\S]*?\{lessonPath\}[\s\S]*?\{modeControl\}[\s\S]*?Current objective/);
  assert.match(lesson, /Complete the steps in order\. Your progress is saved after every valid pass\./);
  assert.match(lesson, /Recommended/);
});

test("guided exercises communicate completed current and next state without exposing locked steps", () => {
  const lesson = source("pages/LessonPage.jsx");
  assert.match(lesson, /done \? "Completed" : active \? "Current step" : "Next"/);
  assert.match(lesson, /disabled=\{!available\}/);
  assert.match(lesson, /aria-current=\{active \? "step" : undefined\}/);
  assert.match(lesson, /\{guidedPassedCount\}\/\{lesson\.exercises\.length\} complete/);
});

test("typing surface clearly exposes ready running paused and resume states", () => {
  const workspace = source("components/typing/TypingWorkspace.jsx");
  assert.match(workspace, /Ready for your first key/);
  assert.match(workspace, /Keep typing/);
  assert.match(workspace, /Your position and timer are safe\. Resume when ready\./);
  assert.match(workspace, /Click here to continue typing/);
  assert.match(workspace, /Start typing — timing begins with your first accepted character\./);
  assert.match(workspace, /sm:hidden">Next:/);
});

test("guided result screen prioritises accuracy and gives an explicit next step", () => {
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

test("mastery detail is progressive disclosure instead of blocking the primary next action", () => {
  const results = source("components/typing/SessionResults.jsx");
  assert.match(results, /<details className="group rounded-3xl border border-violet-200/);
  assert.match(results, /View requirements/);
  assert.match(results, /Next priority:/);
});

test("lesson completion clearly moves forward and explains automatic spaced review", () => {
  const lesson = source("pages/LessonPage.jsx");
  assert.match(lesson, /Review is handled automatically/);
  assert.match(lesson, /short spaced review when it is actually due/);
  assert.match(lesson, /Continue to lesson \{nextLesson\.number\}/);
  assert.match(lesson, /Your progress is saved and the course can move forward/);
});
