# Lesson long-text key-frequency report

Date: 2 August 2026

## Decision

The concern was valid. The earlier generator guaranteed that a declared focus key appeared, but a minimum-presence check was not a sufficient learning standard. A learner can technically receive every target while still receiving too little practice on a rare key, an imbalanced pair, or no explicit rare-letter protection in a review lesson.

The course now treats coverage, balance, and naturalness as separate requirements.

## Published guidance used

No reputable source reviewed publishes one universal percentage that every new key must occupy in every typing lesson. The numerical floors below are therefore an explicit internal course policy, not a falsely attributed industry standard. The design direction is supported by these sources:

- [KTouch course-authoring guidance](https://docs.kde.org/stable_kf6/en/ktouch/ktouch/extending.html) recommends introducing two new keys per lesson, making newly introduced characters the most or at least very frequently used characters, inserting repetition lessons every two or three lessons, using an even character mix in repetition lessons, preferring real words and sentences, and avoiding lessons shorter than roughly 600 characters.
- [How To Type teacher guide](https://www.how-to-type.com/for-teachers/) uses a progression from isolated new-key repetition to consolidation and then sentences or stories. It recommends short technique drills, repeatable fresh patterns, accuracy before speed, and 95% or better before progression.
- [Typing.com teacher guide](https://www.typing.com/en-gb/teacher/resources/learn-to-type/typing-com-teacher-guide.pdf) describes scaffolding from basic keys into contextual sentence and paragraph practice, additional personalized practice for weak keys, and accuracy-led progression.
- [Teaching Keyboarding, ERIC ED378370](https://files.eric.ed.gov/fulltext/ED378370.pdf) recommends daily practice followed by periodic practice and review, special drills for weak keys, and technique rather than speed as the main objective of beginning instruction.

## Audit scope

The automated audit generates every one of the 27 lessons at all selectable long-text lengths:

- 100, 200, 300, and 500 words
- 40 deterministic seeds per length
- 4,320 generated long-text sessions
- 103 explicitly audited targets after adding all 26 letters to the alphabet-review contract

For each generated session it checks:

- requested length
- allowed-character safety
- minimum occurrences of every declared target
- paired-key and checkpoint balance where applicable
- intact words rather than words damaged by removing unavailable characters

The audit can be repeated with:

```sh
node scripts/auditLessonLongTextCoverage.mjs
```

## Problems found in the previous version

- Lesson 25, Emails and forms: `@` averaged 3.4 occurrences per 100 words and `-` averaged 4.1. Both only narrowly cleared the old weak minimum.
- Lesson 10, Q and P: Q received substantially less exposure than P because ordinary word frequency dominated the lesson pool.
- Paired letter-and-symbol lessons such as A/semicolon, C/comma, X/period, and Z/slash were strongly tilted toward the letter.
- Home-row, top-row, and number-row reviews covered all listed targets but did not enforce a meaningful balance between the least-used and most-used target.
- Alphabet fluency declared no auditable coverage targets, so rare letters such as Q, X, J, and Z had no formal guarantee.
- Long sessions could reuse tokens taken from short technique patterns. That was acceptable for early guided drills but not the best default once real compatible words were available.

## Course policy implemented

The following floors scale with the requested session length:

| Target type | Minimum exposure in a 100-word request |
| --- | ---: |
| One of two new letter or number targets | 10 occurrences |
| Shift | 10 uppercase characters |
| Symbol target | 5 occurrences |
| Multi-character transition such as `th`, `ing`, or `qu` | 6 occurrences |
| Letter or number in a review containing up to 10 targets | 5 occurrences |
| Letter in the 26-letter alphabet review | 4 occurrences |

A 500-word request multiplies the proportional parts of these floors by five. Base minimums remain in place for short guided exercises.

Balance contracts were added separately:

- every two-target long lesson: least-used target must reach at least 40% of the most-used target
- home-row, top-row, number-row, and transition reviews: at least 40%
- alphabet fluency: at least 15%, because forcing ordinary English words toward equal letter frequency would produce artificial or misspelled material; every letter also has its own absolute exposure floor

These ratios are guardrails, not goals. The generator normally exceeds them.

## Content changes

- Alphabet fluency now explicitly audits all 26 letters.
- Every paired-key long lesson actively balances both newly introduced movements.
- Module checkpoints continue balancing after their minimum counts have been reached.
- Number-row practice uses balanced numeric groups as well as dates and practical figures.
- Long lesson sessions draw from intact real words that use only keys available at that lesson.
- Short guided focus drills may still use deliberate key patterns where that is pedagogically useful.
- Email, form, sentence, endurance, and assessment lessons retain natural contextual text rather than forcing every keyboard character into every passage.
- Guided content version is now 4 so the recap, Shift-coordination, and connected-transfer material is identifiable in saved evidence.

## Final verification

The final 4,320-session audit reports zero invalid long-text sessions and zero targets below their required floor. Paired and checkpoint sessions also satisfy their declared balance contract.

The most constrained targets are intentionally the contextual email symbols `@` and `-`: each is now guaranteed at least five occurrences for every requested 100 words and scales with longer sessions. Alphabet review now gives every letter explicit repeated exposure while continuing to use intact words.

## Intentional exceptions

- Lessons 19 and 24-27 are fluency or real-world transfer lessons, not new-key lessons. Their text should follow natural language rather than equalizing all 26 letters and every symbol.
- The earliest lessons have too few unlocked characters to form a large natural vocabulary. Pattern drills remain appropriate there; real words are introduced as soon as the available key set permits them.
- Exact equality is not the target. Meaningful repeated exposure, correct movement, accuracy, varied text, and later contextual transfer are the target.
