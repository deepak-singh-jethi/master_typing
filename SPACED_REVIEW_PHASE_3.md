# Spaced Review — Phase 3: retention evidence, scheduling, and recovery

## Scope

Phase 3 turns the two-stage review experience from Phase 2 into real retention evidence. It adds review-specific pass/fail rules, advances the existing spaced schedule only after a valid pass, and sends failed reviews into targeted Mistake Recovery before a fresh dedicated review reassessment.

It does **not** redesign the review content or add new review stages. Cold recall remains 30 seconds and fresh transfer remains 60 seconds.

## Retention evidence

A dedicated review produces one combined `spaced-review` result after both stages. The combined result keeps compact stage evidence and the lesson-focus telemetry required for retention and recovery decisions.

The current internal review guardrails are:

- both stages must be valid;
- both timed stages must run to completion;
- Cold recall must contain enough real evidence (at least 10 typed characters);
- Fresh transfer must contain enough real evidence (at least 20 typed characters);
- each stage must reach at least 95% accuracy;
- aggregate error rate on the lesson's declared focus movements must be at most 8%;
- there is no WPM gate.

The 95% / 8% values are project guardrails, not claimed as universal typing-research standards. They follow the course's existing accuracy-first policy and can be tuned later from real learner data without changing the review architecture.

## Scheduler behavior

Only a successful **dedicated review result** can advance the retention schedule:

`3 → 7 → 14 → 30 → 60 days`

After 60 days, a successful review remains on a 60-day interval. A completed review cycle is idempotent: replaying or resaving the same successful cycle cannot increment the review count or interval twice.

A failed review:

- remains `review-due`;
- does not increment `reviewCount`;
- does not set `lastReviewedAt`;
- does not advance or silently restart the interval;
- preserves bounded error evidence for remediation.

The learner's forward course position is never relocked by a failed spaced review.

## Targeted recovery flow

When a review needs refresh, the result page can create Mistake Recovery from the review's actual difficult keys, bigrams, confusion pairs, and mistake words.

Because the recovery retains `sourceType: lesson`, the source lesson remains authoritative for `allowedCharacters`. A review of R/U therefore cannot introduce a future key during recovery.

After successful recovery, the learner returns to a **fresh `/review/:lessonId/session` reassessment**. The remediation chain supplies a stable reassessment variant, so its text differs from the failed review but remains stable if that reassessment is refreshed. A direct retry after failure also receives a fresh review variant. Recovery itself does not prove retention; the fresh review is the evidence that can advance the schedule.

## Full lesson replay is separate

Reopening a mastered lesson is available as optional re-practice/reteaching, but it no longer counts as spaced-review evidence and cannot move the retention schedule. This keeps the product roles distinct:

- Lesson: teach or revisit technique.
- Spaced Review: test retained movement after time.
- Mistake Recovery: repair the exact failed movement.
- Fresh Review reassessment: verify retention after repair.

## Persistence and daily plan

Review sessions use the existing session/history/cloud pipeline with compact review metadata. No database migration is required. Review telemetry is excluded from speed-best eligibility.

The daily plan now recognizes a successful dedicated `spaced-review` session as completing the due review instead of requiring the original lesson exercises to be replayed.

## Safety invariants

1. Review schedule advancement requires one valid dedicated review result for the current due cycle.
2. A cycle can advance at most once.
3. Failure stays due and preserves the existing cycle identity until a real pass.
4. Recovery and reassessment remain inside the source lesson character boundary.
5. Full lesson replay cannot substitute for dedicated retention evidence.
6. Speed never compensates for insufficient review accuracy.
