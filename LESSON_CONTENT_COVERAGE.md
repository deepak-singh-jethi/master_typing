# Lesson content coverage review

Status: implemented and verified on 2026-08-02.

For the stricter frequency, balance, and intact-word audit added after student testing, see [LESSON_LONG_TEXT_FREQUENCY_REPORT.md](./LESSON_LONG_TEXT_FREQUENCY_REPORT.md).
For the research-led lesson-structure and motor-learning audit, see [CURRICULUM_RESEARCH_AUDIT.md](./CURRICULUM_RESEARCH_AUDIT.md).

## Scope

All 27 lessons were checked in every student-selectable lesson mode:

- 81 guided exercises.
- Longer text at 100, 200, 300, and 500 words.
- Timed practice at 1, 3, 5, and 10 minutes.
- Literal letters, digits, punctuation, Shift-generated capitals, bigrams, trigrams, and longer patterns.
- Allowed-character safety, minimum length, immediate repetition, and generated-content metadata.

## Problems found

- Multi-character targets such as `ing`, `tion`, and `qu` were present in the curriculum but were not active balancing targets in generated content.
- Advanced natural-text lessons selected focus symbols probabilistically. A valid 100-word Emails and Forms session could therefore contain no `@` character.
- Earlier longer-text tests covered only 200-word samples and three seeds; they did not cover all buttons available in the lesson UI.

## Correction

- Guided content version increased from 1 to 2.
- Every generated lesson now has explicit coverage requirements derived from the lesson and current exercise.
- Normal guided exercises cover the targets taught by that exercise.
- Cumulative checkpoint exercises cover every target declared by the checkpoint lesson.
- Longer and timed modes cover every declared lesson target, with repetitions increasing for longer sessions.
- Advanced sentence/document selection reserves suitable natural items before filling the rest of the session.
- Multi-character patterns participate in both weighting and final coverage validation.
- Generated metadata includes the target, required count, actual count, and pass/fail result.

Lessons with no declared focus keys are fluency/application lessons. They are checked for length, character safety, variety, and valid content, but rare keys are not inserted artificially when that would damage natural writing.

## Stress audit

The strict audit generated 11,880 outputs:

- 27 lessons × 3 guided exercises × 40 seeds.
- 27 lessons × 8 longer/timed configurations × 40 seeds.

Result: **11,880 passed; 0 missing-target, short-text, disallowed-character, or repetition failures**.

The automated regression suite keeps a smaller representative version of this matrix in `src/tests/lessonContentCoverage.test.js` so normal project checks remain practical.
