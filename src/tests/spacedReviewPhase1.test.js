import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSpacedReviewEntryState, SPACED_REVIEW_ENTRY_VERSION } from "../lib/spacedReview.js";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const lesson = {
  id: "home-f-j",
  number: 1,
  title: "F and J anchors",
  allowedCharacters: "fj ",
  focusKeys: ["f", "j", "Space"],
};

const nextLesson = { id: "top-r-u", number: 8, title: "R and U" };

test("phase 1 builds a dedicated due-review entry state without changing lesson identity", () => {
  const state = buildSpacedReviewEntryState({
    lesson,
    nextLesson,
    mastery: {
      state: "mastered",
      masteredAt: "2026-08-10T10:00:00.000Z",
      dueAt: "2026-08-13T10:00:00.000Z",
      reviewIntervalDays: 3,
      reviewCount: 0,
    },
    now: new Date("2026-08-14T10:00:00.000Z"),
  });

  assert.equal(state.version, SPACED_REVIEW_ENTRY_VERSION);
  assert.equal(state.kind, "spaced-review");
  assert.equal(state.status, "due");
  assert.equal(state.canReview, true);
  assert.equal(state.sourceId, "home-f-j");
  assert.equal(state.reviewRoute, "/review/home-f-j");
  assert.equal(state.lessonRoute, "/learn/home-f-j");
  assert.deepEqual(state.currentLesson, nextLesson);
  assert.equal(state.allowedCharacters, "fj ");
});

test("phase 1 does not make an unmastered lesson reviewable", () => {
  const state = buildSpacedReviewEntryState({ lesson, mastery: {}, nextLesson });
  assert.equal(state.status, "unavailable");
  assert.equal(state.canReview, false);
});

test("phase 1 keeps scheduled mastered lessons separate from due reviews", () => {
  const state = buildSpacedReviewEntryState({
    lesson,
    mastery: {
      state: "mastered",
      masteredAt: "2026-08-14T10:00:00.000Z",
      dueAt: "2026-08-17T10:00:00.000Z",
      reviewIntervalDays: 3,
    },
    now: new Date("2026-08-14T10:00:00.000Z"),
  });
  assert.equal(state.status, "scheduled");
  assert.equal(state.canReview, false);
});

test("router and course links send due reviews to the dedicated review route", () => {
  const router = source("app/AppRouter.jsx");
  const learn = source("pages/LearnPage.jsx");
  const dashboard = source("lib/uiExperience.js");

  assert.match(router, /path="review\/:lessonId" element=\{<ReviewPage \/>\}/);
  assert.match(learn, /state === MASTERY_STATES\.REVIEW_DUE[\s\S]*?`\/review\/\$\{lesson\.id\}`/);
  assert.match(dashboard, /to: `\/review\/\$\{review\.lessonId\}`/);
  assert.doesNotMatch(dashboard, /label: "Start review",\s*to: `\/learn\/\$\{review\.lessonId\}`/);
});

test("dedicated review entry stays separate from lesson mastery and the original teaching flow", () => {
  const reviewPage = source("pages/ReviewPage.jsx");
  assert.match(reviewPage, /Start short review/);
  assert.match(reviewPage, /review\.reviewSessionRoute/);
  assert.match(reviewPage, /Revisit full lesson/);
  assert.doesNotMatch(reviewPage, /completeLesson|recordSession|applyGuidedLessonResult|finaliseLessonMastery/);
});
