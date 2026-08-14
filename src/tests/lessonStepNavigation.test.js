import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLessonById } from "../data/curriculum.js";
import {
  getInitialLessonExerciseIndex,
  getLessonStepAccess,
  getPassedLessonExerciseIndexes,
} from "../lib/lessonStepAccess.js";
import {
  getLessonSessionSeedKey,
  getOrCreateLessonSessionSeed,
  setLessonSessionSeed,
} from "../lib/lessonSessionState.js";
import {
  buildRecoveryIdentity,
  createRecoverySnapshot,
  loadRecoverySnapshot,
  saveRecoverySnapshot,
} from "../lib/sessionRecovery.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values),
  };
}

function masteryWithPassed(lesson, indexes) {
  return {
    exerciseResults: Object.fromEntries(indexes.map((index) => [
      lesson.exercises[index].id,
      { passed: true, lastPassedAt: "2026-08-14T12:00:00.000Z" },
    ])),
  };
}

test("passing step 1 permanently unlocks step 2 while step 3 remains locked", () => {
  const lesson = getLessonById("top-r-u");
  const mastery = masteryWithPassed(lesson, [0]);
  const passed = getPassedLessonExerciseIndexes(lesson, mastery);
  const access = getLessonStepAccess(lesson, passed);

  assert.deepEqual(passed, [0]);
  assert.equal(access[0].completed, true);
  assert.equal(access[0].unlocked, true);
  assert.equal(access[1].completed, false);
  assert.equal(access[1].unlocked, true);
  assert.equal(access[2].unlocked, false);
  assert.equal(getInitialLessonExerciseIndex(lesson, passed), 1);
});

test("moving backward cannot revoke an already unlocked step", () => {
  const lesson = getLessonById("top-r-u");
  const passed = [0];

  const beforeGoingBack = getLessonStepAccess(lesson, passed);
  // Selection is deliberately not part of the access contract. Viewing step 1
  // cannot mutate the prerequisite evidence that unlocked step 2.
  const afterGoingBack = getLessonStepAccess(lesson, passed);

  assert.equal(beforeGoingBack[1].unlocked, true);
  assert.equal(afterGoingBack[1].unlocked, true);
});

test("future steps unlock only after all prerequisites have passed", () => {
  const lesson = getLessonById("top-r-u");
  assert.deepEqual(
    getLessonStepAccess(lesson, [])[0].unlocked,
    true,
  );
  assert.equal(getLessonStepAccess(lesson, [])[1].unlocked, false);
  assert.equal(getLessonStepAccess(lesson, [0])[2].unlocked, false);
  assert.equal(getLessonStepAccess(lesson, [0, 1])[2].unlocked, true);
});

test("a mastered lesson exposes every guided step for replay", () => {
  const lesson = getLessonById("home-d-k");
  const access = getLessonStepAccess(lesson, [], { mastered: true });

  assert.equal(access.length, lesson.exercises.length);
  assert.ok(access.every((step) => step.unlocked));
  assert.ok(access.every((step) => step.completed));
  assert.equal(getInitialLessonExerciseIndex(lesson, [], { mastered: true }), 0);
});

test("multiple unfinished lesson attempts can coexist in one workspace", () => {
  const storage = memoryStorage();
  const first = buildRecoveryIdentity({
    workspaceId: "user:deepak",
    target: "fj fj jf",
    sessionId: "lesson:home-f-j:guided:focus",
  });
  const second = buildRecoveryIdentity({
    workspaceId: "user:deepak",
    target: "dk dk kd",
    sessionId: "lesson:home-d-k:guided:focus",
  });

  assert.notEqual(first.key, second.key);
  saveRecoverySnapshot(first, createRecoverySnapshot({
    identity: first,
    telemetry: { typed: "fj", target: "fj fj jf" },
    elapsedMs: 1200,
  }), storage);
  saveRecoverySnapshot(second, createRecoverySnapshot({
    identity: second,
    telemetry: { typed: "dk", target: "dk dk kd" },
    elapsedMs: 900,
  }), storage);

  assert.equal(loadRecoverySnapshot(first, storage)?.telemetry.typed, "fj");
  assert.equal(loadRecoverySnapshot(second, storage)?.telemetry.typed, "dk");
});

test("guided exercise seeds stay stable across navigation and rotate only for fresh text", () => {
  const storage = memoryStorage();
  const identity = { workspaceId: "guest", lessonId: "top-r-u", exerciseId: "top-r-u-words" };
  const first = getOrCreateLessonSessionSeed(identity, storage, 12345);
  const restored = getOrCreateLessonSessionSeed(identity, storage, 99999);
  const fresh = setLessonSessionSeed(identity, 54321, storage);

  assert.equal(first, 12345);
  assert.equal(restored, 12345);
  assert.equal(fresh, 54321);
  assert.equal(getOrCreateLessonSessionSeed(identity, storage, 77777), 54321);
  assert.match(getLessonSessionSeedKey(identity), /top-r-u/);
});

test("lesson UI keeps connectors in the gaps and derives access from passed prerequisites", () => {
  const lessonPage = source("pages/LessonPage.jsx");

  assert.match(lessonPage, /getLessonStepAccess\(lesson, passedExercises/);
  assert.match(lessonPage, /left-full top-1\/2 hidden h-px w-3/);
  assert.doesNotMatch(lessonPage, /left-\[11%\] right-\[11%\] top-9/);
  assert.match(lessonPage, /Completed · Replaying/);
  assert.match(lessonPage, /: "Locked"/);
});

test("mastered lesson replay cannot move course position or spaced-review scheduling", () => {
  const lessonPage = source("pages/LessonPage.jsx");
  const provider = source("context/AppProvider.jsx");

  assert.match(lessonPage, /if \(lessonMastered\) \{[\s\S]*setLessonFinished\("revisited"\)[\s\S]*return;/);
  assert.match(lessonPage, /course position and spaced-review schedule were not changed/);
  assert.match(provider, /completedLessons\.includes\(session\.lessonId\)/);
  assert.match(provider, /Only the dedicated review flow is allowed to move the retention schedule/);
});

test("unfinished exercise recovery is scoped to the exact lesson step", () => {
  const workspace = source("components/typing/TypingWorkspace.jsx");
  const lessonPage = source("pages/LessonPage.jsx");
  const recovery = source("lib/sessionRecovery.js");

  assert.match(workspace, /recoverySessionId \|\| `\$\{sessionLabel\}:\$\{title\}`/);
  assert.match(lessonPage, /recoverySessionId={`lesson:\$\{lesson\.id\}:\$\{practiceMode\}:\$\{exercise\.id\}`}/);
  assert.match(recovery, /key: `\$\{RECOVERY_PREFIX\}\$\{workspaceId\}:\$\{hashText\(normalisedSessionId\)\}`/);
});
