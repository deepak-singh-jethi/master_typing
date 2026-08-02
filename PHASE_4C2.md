# Typing Master — Phase 4C.2

## Content and difficulty system

Phase 4C.2 turns the Phase 4C.1 recipe engine into a structured typing-content system. Difficulty is no longer estimated mainly from word length. Every generated item can now be evaluated using word frequency, keyboard movement, same-finger transitions, hand alternation, repeated letters, uncommon bigrams, row movement, hand balance, capitals, punctuation, numbers, and symbols.

## Included

- Four vocabulary-frequency tiers.
- QWERTY hand, finger, row, and movement metadata.
- Easy, balanced, hard, and learner-stage adaptive motor profiles.
- Progressive capitals, punctuation, numbers, and symbols.
- Combinatorial natural-sentence templates for General, Study, Work, Technology, and Government content.
- Separate practical document families for everyday writing, office email, forms/data entry, study, government, and technology.
- Document templates for email, meeting notes, application records, weekly reports, official notices, and data-entry records.
- Content fingerprints, recent-history exclusions, immediate-repeat prevention, and freshness retries.
- Generation-quality metadata in results and compact cloud session summaries.
- Dedicated Phase 4C.2 regression tests.

## Compatibility

- Existing Phase 4C.1 recipes remain valid.
- Existing local progress does not require a data migration.
- Existing Supabase tables and RPC signatures remain compatible; Phase 4C.2 adds fields only inside the existing JSON metadata payload.
- Guest mode and account cloud sync remain local-first.

## Local verification

```bash
npm install
npm run check
npm run dev
```
