import test from "node:test";
import assert from "node:assert/strict";
import {
  COURSE_ID,
  CURRICULUM_VERSION,
  GUIDED_CONTENT_VERSION,
  lessons,
} from "../data/curriculum.js";
import {
  assessGuidedLessonContent,
  generateGuidedLessonExercise,
} from "../data/contentBank.js";
import { toSessionPayload } from "../lib/cloudSync.js";
import { compactAttemptSummary } from "../lib/historyStore.js";

const STABLE_COURSE_SHAPE = [
  ["home-f-j", ["anchors", "alternation", "space"]],
  ["home-d-k", ["reach", "control", "sequence"]],
  ["home-s-l", ["reach", "control", "rhythm"]],
  ["home-a-semicolon", ["reach", "words", "phrase"]],
  ["home-g-h", ["reach", "words", "phrase"]],
  ["home-row-fluency", ["map", "words", "apply"]],
  ["top-e-i", ["reach", "words", "apply"]],
  ["top-r-u", ["reach", "words", "apply"]],
  ["top-w-o", ["reach", "words", "apply"]],
  ["top-q-p", ["reach", "words", "apply"]],
  ["top-t-y", ["reach", "words", "apply"]],
  ["top-row-fluency", ["map", "words", "apply"]],
  ["bottom-c-comma", ["reach", "words", "apply"]],
  ["bottom-v-m", ["reach", "words", "apply"]],
  ["bottom-x-period", ["reach", "words", "apply"]],
  ["bottom-z-slash", ["reach", "words", "apply"]],
  ["bottom-b-n", ["reach", "words", "apply"]],
  ["alphabet-fluency", ["alphabet", "pangram", "apply"]],
  ["common-words", ["frequent", "work", "study"]],
  ["capital-letters", ["names", "sentences", "apply"]],
  ["punctuation", ["comma", "questions", "apply"]],
  ["numbers-dates", ["groups", "dates", "apply"]],
  ["transition-control", ["bigrams", "trigrams", "repeats"]],
  ["practical-sentences", ["study", "work", "form"]],
  ["emails-forms", ["email", "contact", "request"]],
  ["endurance", ["paragraph", "work", "study"]],
  ["foundation-assessment", ["accuracy", "practical", "final"]],
];

test("curriculum versioning preserves every existing lesson and exercise identifier", () => {
  assert.equal(COURSE_ID, "touch-typing-path");
  assert.equal(CURRICULUM_VERSION, 2);
  assert.equal(GUIDED_CONTENT_VERSION, 4);
  assert.deepEqual(
    lessons.map((lesson) => [lesson.id, lesson.exercises.map((exercise) => exercise.id)]),
    STABLE_COURSE_SHAPE,
  );
  for (const lesson of lessons) {
    assert.equal(lesson.curriculumVersion, CURRICULUM_VERSION);
    assert.deepEqual(lesson.exercises.map((exercise) => exercise.stage), ["focus", "control", "transfer"]);
    assert.ok(lesson.exercises.every((exercise) => exercise.contentVersion === GUIDED_CONTENT_VERSION));
  }
});

test("guided word targets grow by stage and exceed the original seed material", () => {
  for (const lesson of lessons) {
    const targets = lesson.exercises.map((exercise) => exercise.targetWords);
    assert.ok(targets[0] < targets[1] && targets[1] < targets[2], `${lesson.id} should grow from focus to transfer`);
    for (const exercise of lesson.exercises) {
      const seedWords = exercise.target.trim().split(/\s+/).filter(Boolean).length;
      assert.ok(exercise.targetWords > seedWords, `${lesson.id}/${exercise.id} should extend its seed material`);
    }
  }
});

test("all guided exercises generate valid, varied, key-safe content across representative seeds", () => {
  for (const lesson of lessons) {
    for (const exercise of lesson.exercises) {
      for (const seed of [11, 42, 91, 20260801]) {
        const generated = generateGuidedLessonExercise({ lessonId: lesson.id, exerciseId: exercise.id, seed });
        const quality = assessGuidedLessonContent({ lesson, exercise, text: generated.text });
        assert.equal(quality.valid, true, `${lesson.id}/${exercise.id}/${seed}: ${quality.issues.join(", ")}`);
        assert.equal(generated.metadata.immediateRepeats, 0);
        assert.ok(generated.metadata.wordCount >= exercise.targetWords);
        assert.ok([...generated.text].every((character) => lesson.allowedCharacters.includes(character)));
        assert.equal(generated.metadata.curriculumVersion, CURRICULUM_VERSION);
        assert.equal(generated.metadata.contentVersion, GUIDED_CONTENT_VERSION);
        assert.equal(generated.metadata.guidedStage, exercise.stage);
      }
    }
  }
});

test("guided exercises are deterministic for one seed and fresh across new seeds", () => {
  for (const lesson of lessons) {
    for (const exercise of lesson.exercises) {
      const first = generateGuidedLessonExercise({ lessonId: lesson.id, exerciseId: exercise.id, seed: 7 });
      const repeated = generateGuidedLessonExercise({ lessonId: lesson.id, exerciseId: exercise.id, seed: 7 });
      assert.equal(first.text, repeated.text);

      const fingerprints = new Set([7, 17, 27].map((seed) => (
        generateGuidedLessonExercise({ lessonId: lesson.id, exerciseId: exercise.id, seed }).metadata.fingerprint
      )));
      assert.equal(fingerprints.size, 3, `${lesson.id}/${exercise.id} should provide fresh generated text`);
    }
  }
});

test("new-key modules include an even recap after no more than three introductions", () => {
  const expectedRecaps = [
    "home-s-l",
    "home-row-fluency",
    "top-w-o",
    "top-row-fluency",
    "bottom-x-period",
    "alphabet-fluency",
  ];
  assert.deepEqual(
    lessons.slice(0, 18)
      .filter((lesson) => lesson.exercises.some((exercise) => exercise.cumulativeReview))
      .map((lesson) => lesson.id),
    expectedRecaps,
  );

  for (const lessonId of ["home-s-l", "top-w-o", "bottom-x-period"]) {
    const lesson = lessons.find((item) => item.id === lessonId);
    const recap = lesson.exercises.find((exercise) => exercise.cumulativeReview);
    assert.ok(recap.reviewTargets.length >= 6, `${lessonId} should review all keys from the three preceding introductions`);
  }
});

test("capital coordination isolates each opposite Shift hand before mixing both", () => {
  const lesson = lessons.find((item) => item.id === "capital-letters");
  const leftSupport = lesson.exercises.find((exercise) => exercise.shiftHand === "left");
  const rightSupport = lesson.exercises.find((exercise) => exercise.shiftHand === "right");
  const leftText = generateGuidedLessonExercise({ lessonId: lesson.id, exerciseId: leftSupport.id, seed: 17 }).text;
  const rightText = generateGuidedLessonExercise({ lessonId: lesson.id, exerciseId: rightSupport.id, seed: 17 }).text;
  const leftSupported = new Set(["Y", "U", "I", "O", "P", "H", "J", "K", "L", "N", "M"]);
  const rightSupported = new Set(["Q", "W", "E", "R", "T", "A", "S", "D", "F", "G", "Z", "X", "C", "V", "B"]);
  assert.ok((leftText.match(/[A-Z]/g) ?? []).every((letter) => leftSupported.has(letter)));
  assert.ok((rightText.match(/[A-Z]/g) ?? []).every((letter) => rightSupported.has(letter)));
});

test("guided transfer keeps a connected phrase before varied generated practice", () => {
  for (const lesson of lessons.slice(3, 23)) {
    const transfer = lesson.exercises.find((exercise) => exercise.stage === "transfer");
    const generated = generateGuidedLessonExercise({ lessonId: lesson.id, exerciseId: transfer.id, seed: 29 });
    const anchor = [...transfer.target]
      .map((character) => lesson.allowedCharacters.includes(character) ? character : /\s/.test(character) ? " " : "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    assert.ok(generated.text.startsWith(anchor), `${lesson.id} should begin transfer with connected text`);
    assert.ok(generated.metadata.wordCount > anchor.split(/\s+/).length, `${lesson.id} should add varied practice after the anchor`);
  }
});

test("guided content versions survive compact history and cloud payload conversion", () => {
  const attempt = {
    id: "guided-version-test",
    type: "lesson",
    lessonId: "home-f-j",
    exerciseId: "anchors",
    curriculumVersion: CURRICULUM_VERSION,
    contentVersion: GUIDED_CONTENT_VERSION,
    guidedStage: "focus",
  };
  const compact = compactAttemptSummary(attempt);
  const cloud = toSessionPayload(attempt);
  assert.equal(compact.curriculumVersion, CURRICULUM_VERSION);
  assert.equal(compact.contentVersion, GUIDED_CONTENT_VERSION);
  assert.equal(compact.guidedStage, "focus");
  assert.equal(cloud.metadata.curriculumVersion, CURRICULUM_VERSION);
  assert.equal(cloud.metadata.contentVersion, GUIDED_CONTENT_VERSION);
  assert.equal(cloud.metadata.guidedStage, "focus");
});
