import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lessons, getLessonById } from "../data/curriculum.js";
import { getPrimaryDiagnosis } from "../lib/resultCoaching.js";
import {
  buildSpacedReviewEntryState,
  buildSpacedReviewSessionPlan,
  getSpacedReviewSessionSeed,
  SPACED_REVIEW_SESSION_VERSION,
} from "../lib/spacedReview.js";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function dueMastery(overrides = {}) {
  return {
    state: "mastered",
    masteredAt: "2026-08-01T10:00:00.000Z",
    dueAt: "2026-08-13T10:00:00.000Z",
    reviewIntervalDays: 3,
    reviewCount: 0,
    ...overrides,
  };
}

function assertAllowed(text, allowedCharacters, message) {
  const invalid = [...String(text || "")].filter((character) => !allowedCharacters.includes(character));
  assert.deepEqual([...new Set(invalid)], [], message);
}

test("phase 2 exposes a dedicated 30-second cold recall and 60-second fresh transfer", () => {
  const lesson = getLessonById("top-r-u");
  const plan = buildSpacedReviewSessionPlan({ lesson, mastery: dueMastery() });

  assert.equal(plan.version, SPACED_REVIEW_SESSION_VERSION);
  assert.equal(plan.kind, "spaced-review-session");
  assert.equal(plan.lessonId, "top-r-u");
  assert.equal(plan.totalDurationSeconds, 90);
  assert.deepEqual(plan.stages.map((stage) => [stage.id, stage.durationSeconds]), [
    ["cold-recall", 30],
    ["fresh-transfer", 60],
  ]);
  assert.ok(plan.stages[0].target.length > 250);
  assert.ok(plan.stages[1].target.length > 250);
  assert.notEqual(plan.stages[0].fingerprint, plan.stages[1].fingerprint);
});

test("phase 2 keeps both review stages inside every source lesson character boundary", () => {
  for (const lesson of lessons) {
    const plan = buildSpacedReviewSessionPlan({
      lesson,
      mastery: dueMastery({ dueAt: `2026-08-${String(Math.min(13, lesson.number)).padStart(2, "0")}T10:00:00.000Z` }),
      seed: 7000 + lesson.number,
    });

    assert.equal(plan.stages.length, 2, `${lesson.id}: expected two review stages`);
    plan.stages.forEach((stage) => {
      assert.ok(stage.target.length > 0, `${lesson.id}/${stage.id}: empty target`);
      assertAllowed(stage.target, lesson.allowedCharacters, `${lesson.id}/${stage.id}: generated a locked character`);
    });
  }
});

test("F/J review stays restricted to learned anchors while R/U review cannot leak future keys", () => {
  const fj = buildSpacedReviewSessionPlan({ lesson: getLessonById("home-f-j"), mastery: dueMastery(), seed: 101 });
  fj.stages.forEach((stage) => {
    assertAllowed(stage.target, "fj ", `F/J ${stage.id} leaked another key`);
    assert.match(stage.target, /f/);
    assert.match(stage.target, /j/);
  });

  const ruLesson = getLessonById("top-r-u");
  const ru = buildSpacedReviewSessionPlan({ lesson: ruLesson, mastery: dueMastery(), seed: 202 });
  ru.stages.forEach((stage) => assertAllowed(stage.target, ruLesson.allowedCharacters, `R/U ${stage.id} leaked a future key`));
  assert.match(ru.stages[0].target, /r/);
  assert.match(ru.stages[0].target, /u/);
  assert.match(ru.stages[1].target, /r/);
  assert.match(ru.stages[1].target, /u/);
  assert.doesNotMatch(ru.stages[1].target, /[wopqtyzxcvbnm]/i);
});

test("fresh transfer is generated material rather than an exact replay of an original exercise", () => {
  for (const lessonId of ["home-f-j", "home-a-semicolon", "top-r-u", "top-row-fluency", "practical-sentences"]) {
    const lesson = getLessonById(lessonId);
    const plan = buildSpacedReviewSessionPlan({ lesson, mastery: dueMastery(), seed: 909 + lesson.number });
    const transfer = plan.stages[1].target.trim();
    assert.ok(!lesson.exercises.some((exercise) => String(exercise.target).trim() === transfer), `${lessonId}: transfer exactly replayed an exercise`);
  }
});

test("review seed is stable inside one due cycle and changes for a later review cycle", () => {
  const lesson = getLessonById("top-r-u");
  const first = dueMastery();
  const second = dueMastery({
    dueAt: "2026-08-20T10:00:00.000Z",
    reviewIntervalDays: 7,
    reviewCount: 1,
  });

  const firstSeed = getSpacedReviewSessionSeed({ lesson, mastery: first });
  assert.equal(firstSeed, getSpacedReviewSessionSeed({ lesson, mastery: { ...first } }));
  assert.notEqual(firstSeed, getSpacedReviewSessionSeed({ lesson, mastery: second }));

  const firstPlan = buildSpacedReviewSessionPlan({ lesson, mastery: first });
  const repeatedPlan = buildSpacedReviewSessionPlan({ lesson, mastery: { ...first } });
  const laterPlan = buildSpacedReviewSessionPlan({ lesson, mastery: second });
  assert.deepEqual(firstPlan.stages.map((stage) => stage.fingerprint), repeatedPlan.stages.map((stage) => stage.fingerprint));
  assert.notDeepEqual(firstPlan.stages.map((stage) => stage.fingerprint), laterPlan.stages.map((stage) => stage.fingerprint));
});

test("phase 2 generation remains pure even after later phases attach review scoring", () => {
  const lesson = getLessonById("home-f-j");
  const mastery = dueMastery();
  const snapshot = structuredClone(mastery);
  buildSpacedReviewSessionPlan({ lesson, mastery });
  buildSpacedReviewEntryState({ lesson, mastery, now: new Date("2026-08-14T10:00:00.000Z") });
  assert.deepEqual(mastery, snapshot);

  const sessionPage = source("pages/ReviewSessionPage.jsx");
  assert.match(sessionPage, /resultPassEvaluator=\{\(\) => true\}/);
});

test("review entry and router now launch the dedicated session shell", () => {
  const lesson = getLessonById("home-f-j");
  const entry = buildSpacedReviewEntryState({
    lesson,
    mastery: dueMastery(),
    now: new Date("2026-08-14T10:00:00.000Z"),
  });
  assert.equal(entry.reviewSessionRoute, "/review/home-f-j/session");

  const router = source("app/AppRouter.jsx");
  const reviewPage = source("pages/ReviewPage.jsx");
  assert.match(router, /path="review\/:lessonId\/session" element=\{<ReviewSessionPage \/>\}/);
  assert.match(reviewPage, /to=\{review\.reviewSessionRoute\}/);
  assert.doesNotMatch(reviewPage, /Start short review[\s\S]{0,120}disabled aria-disabled="true"/);
});



test("both review stages preserve declared lesson focus exposure", () => {
  for (const lesson of lessons) {
    if (!lesson.focusKeys?.length) continue;
    const plan = buildSpacedReviewSessionPlan({ lesson, mastery: dueMastery(), seed: 5500 + lesson.number });
    for (const stage of plan.stages) {
      for (const focus of lesson.focusKeys) {
        if (focus === "Space") continue;
        if (focus === "Shift") {
          assert.match(stage.target, /[A-Z]/, `${lesson.id}/${stage.id}: missing Shift/capital exposure`);
        } else {
          assert.ok(
            stage.target.toLowerCase().includes(String(focus).toLowerCase()),
            `${lesson.id}/${stage.id}: missing focus ${focus}`,
          );
        }
      }
    }
  }
});

test("phase 2 review results are neutral evidence, not an early pass/fail decision", () => {
  const diagnosis = getPrimaryDiagnosis({
    result: {
      validSession: true,
      keystrokeAccuracy: 81,
      completion: 42,
      consistency: 20,
      correctionRate: 18,
      netWpm: 17,
    },
    passed: true,
    passAccuracy: 0,
    requireComplete: false,
    resultContext: {
      purpose: "spaced-review",
      reviewStage: "cold-recall",
    },
  });

  assert.equal(diagnosis.tone, "indigo");
  assert.equal(diagnosis.code, "spaced-review-recall");
  assert.match(diagnosis.action, /fresh transfer/i);

  const sessionPage = source("pages/ReviewSessionPage.jsx");
  assert.match(sessionPage, /showLiveWpm=\{false\}/);
  assert.doesNotMatch(sessionPage, /passAccuracy=\{9[0-9]\}/);
});
