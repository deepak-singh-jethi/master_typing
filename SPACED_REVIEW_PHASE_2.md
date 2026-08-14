# Spaced Review — Phase 2: short retention session

## Scope

Phase 2 implements the actual short review experience on top of the dedicated route introduced in Phase 1. It deliberately does **not** change review scoring, mastery state, interval advancement, or remediation routing yet.

## Implemented

- Added `/review/:lessonId/session` inside the focused session shell.
- A due review now starts a two-stage retention session instead of replaying the original three teaching exercises.
- Stage 1 is **Cold recall** for 30 seconds: the learner types from memory before any reteaching, using compact movement material derived from the source lesson.
- Stage 2 is **Fresh transfer** for 60 seconds: the learner receives newly generated curriculum-safe material that checks the same learned movement outside the first recall pattern.
- Both stages inherit the source lesson's exact `allowedCharacters` boundary. Locked/future keys cannot enter review content.
- Early restricted-key lessons keep deliberate mixed key patterns because meaningful words are not yet possible; later lessons use the existing lesson-safe vocabulary/content generator.
- Review generation uses a stable seed tied to the current due cycle. Refreshing the same due review keeps compatible text for session recovery, while a later review cycle receives fresh content.
- Live WPM is hidden during the review session so the interface reinforces accuracy-first retention rather than speed chasing.
- Review results use a neutral review-specific diagnosis. Phase 2 gathers performance inside the session UI but does not call lesson mastery or review-scheduler mutation functions.

## Deliberately not implemented in Phase 2

- No review pass/fail rule.
- No review evidence persistence model.
- No 3 → 7 → 14 → 30 → 60 interval advancement from this session.
- No failed-review transition to Mistake Recovery.
- No relocking or moving the learner's current course position.

Those are Phase 3 responsibilities.

## Safety invariants

1. A spaced review never opens the ordinary lesson teaching flow unless the learner explicitly chooses **Revisit full lesson**.
2. Every character typed in review belongs to the source lesson's `allowedCharacters` set.
3. Completing Phase 2 review practice cannot mutate lesson mastery or advance the spaced-review schedule.
4. Cold recall happens before fresh transfer and before any reteaching.
