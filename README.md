# Typing Master

A local-first adaptive typing-learning application built with React, Vite, Tailwind CSS, and Supabase.

## Current release

**Phase 5 — UI, Accessibility, Mobile Experience, and Closed-Beta Polish**

The app now combines a tested typing engine, diagnostic placement, lesson mastery, spaced review, adaptive practice, account-isolated cloud sync, motor-pattern difficulty scoring, focused result coaching, IndexedDB-backed detailed history, active-session recovery, and a simplified accessible interface designed around one obvious next action.

See [PHASE_5.md](./PHASE_5.md) for the product and interface changes, [CURRICULUM_RESEARCH_AUDIT.md](./CURRICULUM_RESEARCH_AUDIT.md) for the research-led lesson review, and [VALIDATION.md](./VALIDATION.md) for validation details.

## Setup

The configured `.env.local` is included in this development package.

```bash
npm install
npm run check
npm run dev
```

Never place a Supabase service-role key in this frontend project. The included key is the publishable frontend key; data security depends on the existing Row Level Security policies.

## Main commands

```bash
npm run dev      # development server
npm run test     # Node regression suite
npm run lint     # Oxlint
npm run build    # Vite production build
npm run check    # tests + lint + production build
npm run release:check # clean release gate + dependency and license policies
```

## Data model

- Guest progress works locally without an account.
- Signed-in users retain isolated local caches and compact Supabase sync.
- Complete typed text is not uploaded as cloud telemetry.
- Recent detailed telemetry stays in IndexedDB.
- LocalStorage stores compact summaries, settings, sync state, and recovery indexes.
- Existing supported local-data versions migrate automatically.

## Phase 5 experience principles

- One primary action per screen.
- Advanced controls available through progressive disclosure.
- Clear offline, sync, recovery, empty, and error states.
- Keyboard, screen-reader, touch, and reduced-motion support.
- Mobile typing prioritises active text and the device keyboard.
