# Phase 4D — Performance, Storage, and Active-Session Recovery

## Purpose

Phase 4D protects long-term progress and keeps long typing sessions responsive. It separates compact application state from detailed telemetry, restores interrupted work, and gives learners visible control over browser storage.

## IndexedDB detailed history

- Detailed session telemetry is stored in the `typing-master-history` IndexedDB database.
- LocalStorage retains compact summaries for dashboards, comparisons, plans, and analytics.
- The most recent 200 detailed sessions are retained automatically.
- Sessions still waiting in the cloud outbox are protected from pruning.
- Up to 1,000 compact session summaries remain available for long-term analytics.
- Existing detailed attempts from data version 8 are migrated into IndexedDB on first load.

## Compact LocalStorage

- Data version increased to 9.
- Large fields such as typed text, target text, full key maps, bigram maps, and pace series are excluded from LocalStorage summaries.
- Daily activity is bounded to the latest 400 entries.
- Content-freshness history remains bounded to 20 entries.
- Save failures now produce a visible storage-health error rather than only a console warning.

## Active-session recovery

- An unfinished session is saved locally while the learner types.
- Page refresh, accidental tab close, and browser restart can restore typed text, telemetry, elapsed active time, and pace samples.
- Restored sessions always open paused and require an explicit resume.
- Recovery snapshots are isolated by guest/account workspace and session identity.
- Stale, incompatible, completed, and manually reset snapshots are removed safely.

## Long-text rendering

- The typing surface renders only the active text window rather than every character in a long document.
- The current word and approximately 900 characters on either side remain visible.
- Scrolling occurs on word transitions instead of on every keystroke.
- Exact character feedback is preserved inside the rendered window.

## Storage health and recovery controls

Settings now shows:

- compact LocalStorage size;
- detailed IndexedDB session count and size;
- browser storage usage when the browser exposes it;
- healthy, high-usage, checking, and error states;
- manual usage refresh;
- safe pruning of older detailed telemetry;
- complete export containing available detailed session records.

## Cloud and offline behaviour

- Cloud synchronization reloads detailed telemetry from IndexedDB before sending a queued session.
- Typed text remains excluded from Supabase payloads.
- The per-account outbox retains the latest 1,000 unique session IDs.
- Duplicate session IDs remain idempotent through the existing Supabase session constraint and RPC.
- Guest and account IndexedDB scopes remain separate.

## Compatibility

No Supabase migration is required. Existing Phase 4C.3 data is migrated automatically in the browser. The Supabase snapshot data version now reports version 9.
