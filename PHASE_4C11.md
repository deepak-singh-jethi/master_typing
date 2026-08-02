# Phase 4C.1.1 — Stabilisation and identity-safe sync

This release is the mandatory safety gate before Phase 4C.2.

## Achieved

- Isolated guest and per-account browser workspaces
- Safe account switching
- One-time guest migration
- Conflict-safe local/cloud attempt union
- Durable offline outbox and automatic retry
- Manual cloud sync
- Cross-device adaptive telemetry restoration
- Password-recovery route hardening
- Balanced guided and generated lesson key coverage
- String-based guided exercise IDs in Supabase

## Next gate

After `npm run check` is clean on the target Mac, manually test:

1. Guest practice → create account → progress appears once.
2. Account A → sign out → guest data appears, not Account A data.
3. Account A → Account B → no data mixing.
4. Complete a session offline → reconnect → one cloud session is created.
5. Open Settings while signed in → Sync now works without a crash.
6. Request password reset → link opens the reset-password screen.
7. Run whole-home-row guided and 200-word practice → every home-row key appears repeatedly.

Once these pass, development can move to Phase 4C.2: the expanded content and motor-difficulty system.
