# Production Phases 6 and 7 report

Date: 2026-08-02  
Application: 0.5.1  
Decision: implementation complete; public production remains NO-GO until the external staging drills below are evidenced.

## Phase 6 — security and data ownership

Completed:

- Captured all eight user-data tables, constraints, indexes, triggers, ownership policies, grants, and the complete `sync_typing_session` RPC in ordered migrations.
- Added explicit Data API grants compatible with Supabase's 2026 default-grant change.
- Applied `harden_data_api_ownership` to project `wccgwbbxbrgxixhvyghq`.
- Verified a simulated second authenticated identity sees zero rows in every user-data table.
- Verified the real owner identity can still read its own rows.
- Verified anonymous table access and anonymous sync-RPC execution are denied.
- Added and deployed `delete-account` version 1 with JWT verification, five-minute fresh-auth enforcement, matching-user verification, admin deletion, database cascades, global sign-out, and local-scope cleanup.
- Added export-before-delete, explicit `DELETE` confirmation, current-password reauthentication, cancellation, and failure recovery.
- Made account-service initialization failures visible globally with a retry action.
- Added CSP, HSTS, frame, MIME, referrer, permissions, and cache policies.
- Added a strict temporary dependency exception for the one remaining RSC-only React Router advisory. The npm-suggested downgrade was tested and rejected because it reopened multiple materially broader high-severity advisories.

Live evidence:

- Edge Function `delete-account`: ACTIVE, version 2, JWT verification enabled.
- Unauthenticated deletion request: HTTP 401.
- Second-user visible row counts: zero across profiles, settings, progress, mastery, sessions, activity, skills, and sync.
- Anonymous profile/session SELECT: not granted.
- Anonymous `sync_typing_session` EXECUTE: false; authenticated EXECUTE: true.

Outstanding platform configuration:

- Enable Supabase leaked-password protection in Auth settings. The connected management tools expose the advisory but not the setting mutation.
- Run a successful destructive deletion journey using a dedicated staging test account; the real learner account was deliberately not destroyed.
- Confirm exact deployed confirmation/password-reset URL allowlists after staging and production URLs exist.

## Phase 7 — release engineering

Completed:

- Added deterministic Node 22.12.0 and lockfile-based installation.
- Added GitHub Actions for clean install, 181 tests, lint, build, dependency policy, license policy, and immutable artifact upload.
- Added build IDs derived from the commit SHA and exposed them on the recoverable crash screen.
- Added Vercel and generic static-host security/cache configuration.
- Added separate staging/production environment templates and a secret-ownership matrix.
- Added a Supabase local configuration, source-controlled migrations, RLS test, and Edge Function source.
- Added deployment, promotion, rollback, and stop-condition instructions.
- Clean-install `npm run release:check` passed.

Outstanding external evidence:

- Provision a separate staging Supabase project or paid branch after explicit cost confirmation.
- Rebuild that staging project from migrations and run `supabase/tests/rls_ownership.sql`.
- Configure a staging deployment URL, exact auth redirects, and protected variables.
- Rehearse backup restore, client rollback, and a successful staging-account deletion.
- Connect a Git remote and enable protected-main/required-check rules; those settings cannot exist until a remote repository is selected.

These external items prevent claiming the Phase 7 exit gate is fully green, but the repository and connected TYPING backend are prepared for the drills.
