import assert from "node:assert/strict";
import test from "node:test";
import { lessons } from "../data/curriculum.js";
import { commonWords } from "../data/wordBank.js";
import {
  assessGuidedLessonContent,
  assessLessonPracticeContent,
  estimateTargetWords,
  generateGuidedLessonExercise,
  generatePracticeSession,
  getLessonCoverageRequirements,
} from "../data/contentBank.js";

const REPRESENTATIVE_SEEDS = [1, 7, 42, 91, 313, 20260801];
const LESSON_MODE_CONFIGS = [
  { label: "100 words", goalType: "words", wordCount: 100 },
  { label: "200 words", goalType: "words", wordCount: 200 },
  { label: "300 words", goalType: "words", wordCount: 300 },
  { label: "500 words", goalType: "words", wordCount: 500 },
  { label: "1 minute", goalType: "time", durationSeconds: 60 },
  { label: "3 minutes", goalType: "time", durationSeconds: 180 },
  { label: "5 minutes", goalType: "time", durationSeconds: 300 },
  { label: "10 minutes", goalType: "time", durationSeconds: 600 },
];

function assertAllowedCharacters(lesson, text, context) {
  for (const character of text) {
    assert.ok(
      lesson.allowedCharacters.includes(character),
      `${context} introduced unavailable character ${JSON.stringify(character)}`,
    );
  }
}

test("every generated guided exercise meets its explicit focus and checkpoint coverage contract", () => {
  for (const lesson of lessons) {
    for (const exercise of lesson.exercises) {
      for (const seed of REPRESENTATIVE_SEEDS) {
        const context = `${lesson.id}/guided:${exercise.id}/seed:${seed}`;
        const generated = generateGuidedLessonExercise({
          lessonId: lesson.id,
          exerciseId: exercise.id,
          seed,
        });
        const quality = assessGuidedLessonContent({ lesson, exercise, text: generated.text });

        assert.equal(quality.valid, true, `${context}: ${quality.issues.join(", ")}`);
        assert.equal(generated.metadata.guidedQuality.valid, true, context);
        assert.deepEqual(generated.metadata.guidedQuality.coverage, quality.coverage, context);
        assertAllowedCharacters(lesson, generated.text, context);

        for (const target of quality.coverage) {
          assert.ok(
            target.actual >= target.minimum,
            `${context} used ${target.target} ${target.actual}/${target.minimum} times`,
          );
        }
        if (quality.balance.required) {
          assert.ok(
            quality.balance.ratio >= quality.balance.minimumRatio,
            `${context} balance ${quality.balance.ratio}/${quality.balance.minimumRatio}`,
          );
        }
      }
    }
  }
});

test("every selectable longer and timed lesson mode covers all declared lesson targets", () => {
  for (const lesson of lessons) {
    for (const mode of LESSON_MODE_CONFIGS) {
      const targetWords = estimateTargetWords(mode);
      for (const seed of REPRESENTATIVE_SEEDS) {
        const context = `${lesson.id}/${mode.label}/seed:${seed}`;
        const generated = generatePracticeSession({
          contentType: "lesson",
          lessonId: lesson.id,
          seed,
          ...mode,
        });
        const quality = assessLessonPracticeContent({
          lesson,
          text: generated.text,
          targetWords,
        });

        assert.equal(quality.valid, true, `${context}: ${quality.issues.join(", ")}`);
        assert.equal(generated.metadata.lessonCoverage.valid, true, context);
        assert.ok(generated.metadata.wordCount >= targetWords, `${context} is too short`);
        assertAllowedCharacters(lesson, generated.text, context);

        for (const target of quality.coverage) {
          assert.ok(
            target.actual >= target.minimum,
            `${context} used ${target.target} ${target.actual}/${target.minimum} times`,
          );
        }
      }
    }
  }
});

test("multi-character checkpoint patterns and email symbols cannot disappear from generated text", () => {
  const transitionLesson = lessons.find((lesson) => lesson.id === "transition-control");
  const transitionExercise = transitionLesson.exercises.find((exercise) => exercise.id === "repeats");
  const transition = generateGuidedLessonExercise({
    lessonId: transitionLesson.id,
    exerciseId: transitionExercise.id,
    seed: 11,
  });
  const transitionQuality = assessGuidedLessonContent({
    lesson: transitionLesson,
    exercise: transitionExercise,
    text: transition.text,
  });
  const qu = transitionQuality.coverage.find((item) => item.target === "qu");
  assert.ok(qu, "the cumulative checkpoint must require qu");
  assert.ok(qu.actual >= qu.minimum, `qu coverage is ${qu.actual}/${qu.minimum}`);

  const emailLesson = lessons.find((lesson) => lesson.id === "emails-forms");
  const email = generatePracticeSession({
    contentType: "lesson",
    lessonId: emailLesson.id,
    goalType: "words",
    wordCount: 100,
    seed: 91,
  });
  const emailQuality = assessLessonPracticeContent({
    lesson: emailLesson,
    text: email.text,
    targetWords: 100,
  });
  const atSign = emailQuality.coverage.find((item) => item.target === "@");
  assert.ok(atSign);
  assert.ok(atSign.actual >= atSign.minimum, `@ coverage is ${atSign.actual}/${atSign.minimum}`);
});

test("coverage requirements scale by lesson length without dropping any declared target", () => {
  for (const lesson of lessons) {
    const short = getLessonCoverageRequirements({ lesson, targetWords: 100 });
    const long = getLessonCoverageRequirements({ lesson, targetWords: 2050 });
    assert.deepEqual(short.map((item) => item.target), long.map((item) => item.target), lesson.id);
    short.forEach((item, index) => {
      assert.ok(long[index].minimum >= item.minimum, `${lesson.id}/${item.target} should not lose coverage in longer work`);
    });
  }
});

test("mid-module recap exercises enforce balanced exposure across all recently introduced keys", () => {
  for (const lessonId of ["home-s-l", "top-w-o", "bottom-x-period"]) {
    const lesson = lessons.find((item) => item.id === lessonId);
    const exercise = lesson.exercises.find((item) => item.cumulativeReview);
    const generated = generateGuidedLessonExercise({ lessonId, exerciseId: exercise.id, seed: 313 });
    const quality = assessGuidedLessonContent({ lesson, exercise, text: generated.text });
    assert.deepEqual(quality.coverage.map((item) => item.target), exercise.reviewTargets);
    assert.equal(quality.balance.required, true);
    assert.ok(quality.balance.ratio >= quality.balance.minimumRatio);
  }
});

test("long-text exposure floors reflect the type and breadth of the lesson", () => {
  const pairedKeys = lessons.find((lesson) => lesson.id === "top-q-p");
  assert.deepEqual(
    getLessonCoverageRequirements({ lesson: pairedKeys, targetWords: 100 }),
    [{ target: "q", minimum: 10 }, { target: "p", minimum: 10 }],
  );

  const punctuation = lessons.find((lesson) => lesson.id === "punctuation");
  assert.ok(
    getLessonCoverageRequirements({ lesson: punctuation, targetWords: 100 })
      .every((item) => item.minimum === 5),
  );

  const transitions = lessons.find((lesson) => lesson.id === "transition-control");
  assert.ok(
    getLessonCoverageRequirements({ lesson: transitions, targetWords: 100 })
      .every((item) => item.minimum === 6),
  );

  const numbers = lessons.find((lesson) => lesson.id === "numbers-dates");
  assert.ok(
    getLessonCoverageRequirements({ lesson: numbers, targetWords: 100 })
      .every((item) => item.minimum === 5),
  );

  const alphabet = lessons.find((lesson) => lesson.id === "alphabet-fluency");
  const alphabetRequirements = getLessonCoverageRequirements({ lesson: alphabet, targetWords: 100 });
  assert.equal(alphabetRequirements.length, 26);
  assert.ok(alphabetRequirements.every((item) => item.minimum === 4));

  const email = lessons.find((lesson) => lesson.id === "emails-forms");
  const emailRequirements = getLessonCoverageRequirements({ lesson: email, targetWords: 500 });
  assert.ok(emailRequirements.every((item) => item.minimum === 25));
});

test("long lesson sessions use intact compatible words instead of stripped future-key fragments", () => {
  for (const lessonId of ["top-q-p", "alphabet-fluency"]) {
    const lesson = lessons.find((item) => item.id === lessonId);
    const generated = generatePracticeSession({
      contentType: "lesson",
      lessonId,
      goalType: "words",
      wordCount: 200,
      seed: 7,
    });
    const allowedWords = new Set([...commonWords, ...lesson.practiceTokens].map((word) => word.toLowerCase()));
    for (const word of generated.text.split(/\s+/)) {
      assert.ok(allowedWords.has(word.toLowerCase()), `${lessonId} produced an unknown word: ${word}`);
    }
  }
});
