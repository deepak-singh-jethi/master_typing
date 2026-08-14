# Spaced Review — Phase 1: route and session boundary

## Scope

This phase separates scheduled retention review from the original teaching lesson without changing review scheduling, review scoring, content generation, or remediation rules.

## Implemented

- Added `/review/:lessonId` as the dedicated spaced-review entry route.
- Dashboard due-review actions now open the review route instead of `/learn/:lessonId`.
- A lesson marked `REVIEW_DUE` on the Learn page also opens the review route.
- Added a versioned review-entry state contract carrying the canonical source lesson, allowed characters, focus keys, due date, interval, review count, and current course lesson.
- The review page makes it explicit that the learner already mastered the source lesson and that course position does not move backward.
- The original lesson remains available only as the separate `Revisit full lesson` action.

## Deliberately not implemented in Phase 1

- No short review text generator.
- No cold-recall / fresh-transfer review stages.
- No review pass/fail scoring.
- No review interval advancement.
- No review-to-Mistake-Recovery transition.

The short-review start control is therefore disabled. This is intentional: Phase 1 must not fake a spaced review by replaying the old lesson or by recording ordinary lesson/practice evidence as review evidence.

## Invariant

A dashboard or course-path action labelled as spaced review must never navigate directly into the ordinary lesson teaching flow.
