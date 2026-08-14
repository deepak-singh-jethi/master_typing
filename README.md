# Typing Master

Typing Master is a local-first adaptive typing-learning application built with React, Vite, Tailwind CSS, and Supabase.

## Current capabilities

- Progressive 27-lesson curriculum with guided learning and cumulative checkpoints.
- Dedicated spaced-review sessions using cold recall and fresh curriculum-safe transfer rather than replaying completed lessons.
- Review scheduling that advances through `3 → 7 → 14 → 30 → 60` days only after a valid review pass.
- Targeted Mistake Recovery that preserves the source lesson's allowed-character boundary.
- Adaptive practice, diagnostic placement, typing tests, proficiency evidence, and focused result coaching.
- Guest-first local persistence, IndexedDB-backed detailed history, active-session recovery, and account-isolated Supabase sync.
- Accessible desktop-focused interface with keyboard navigation, route announcements, reduced-motion support, and responsive layouts.

## Requirements

- Node.js `22.12.0` or newer.
- npm.
- A Supabase project only if account/cloud features are needed. Guest mode works locally without one.

## Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with the frontend Supabase URL and publishable key when cloud features are required. Never place a Supabase service-role key in this frontend project.

## Main commands

```bash
npm run dev             # local development server
npm run test            # Node regression suite
npm run lint            # Oxlint
npm run build           # Vite production build
npm run check           # tests + lint + production build
npm run release:check   # check + dependency policy + license policy
npm run preview         # preview the production build
```

## Learning architecture

- **Lesson** — teaches or revisits a movement.
- **Spaced Review** — checks whether a previously mastered movement was retained after time has passed.
- **Mistake Recovery** — repairs specific weak keys, transitions, confusions, and missed words.
- **Practice** — lets the learner deliberately train a selected skill or content type.
- **Tests** — provide broader independent typing measurement and proficiency evidence.

A successful spaced review updates the lesson's next review date. A failed review stays due and may enter targeted recovery; it does not relock forward course progress.

## Persistence and sync

- Guest progress is stored locally.
- Signed-in users keep isolated local caches and compact Supabase sync.
- Complete typed text is not uploaded as cloud telemetry.
- Detailed recent telemetry is kept in IndexedDB.
- LocalStorage stores compact summaries, settings, mastery state, recovery state, and sync metadata.
- Existing supported local-data versions migrate automatically.

## Documentation

Durable project documentation is kept intentionally small:

- [`CURRICULUM_RESEARCH_AUDIT.md`](./CURRICULUM_RESEARCH_AUDIT.md) — curriculum and motor-learning design rationale.
- [`LESSON_CONTENT_COVERAGE.md`](./LESSON_CONTENT_COVERAGE.md) — lesson-generation coverage contracts.
- [`LESSON_LONG_TEXT_FREQUENCY_REPORT.md`](./LESSON_LONG_TEXT_FREQUENCY_REPORT.md) — long-session exposure and balance audit.
- [`docs/production/`](./docs/production/) — acceptance, deployment, rollback, security, and release-operation documents.
- [`supabase/README.md`](./supabase/README.md) — Supabase setup and migration notes.

Historical phase handoff notes and one-off validation reports are intentionally not kept in the active project root; the regression tests and Git history are the source of truth for those changes.
