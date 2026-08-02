# Production Phases 6 and 7 report

Date: 2026-08-02  
Application: 0.5.1  
Decision: Phase 7 backend staging gate passed; public production remains NO-GO until hosting, rollback, repository protection, and platform configuration are evidenced.

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
- Provisioned isolated `TYPING-STAGING` (`ttqbbpwvenltvtzjzkzh`) in `ap-southeast-1` at the explicitly approved $0/month quote.
- Rebuilt the empty staging backend from all five ordered repository migrations without relying on production state.
- Deployed `delete-account` version 1 to staging with JWT verification enabled.
- Strengthened and passed the transactional two-account RLS test across all eight user-data tables.
- Completed a real staging-only deletion journey: password authentication and the Edge Function both returned HTTP 200, then Auth and all eight cascaded learner scopes returned zero rows.
- Confirmed an unauthenticated deletion attempt returns HTTP 401.
- Confirmed the staging Supabase security adviser reports zero findings. Three unused-index notices are expected INFO results on the empty staging database and are retained for production query patterns.
- Clean-install `npm run release:check` passed.

Outstanding external evidence:

- Configure a staging deployment URL, exact auth redirects, and protected variables.
- Rehearse backup restore and client rollback against the chosen staging host.
- Connect a Git remote and enable protected-main/required-check rules; those settings cannot exist until a remote repository is selected.

The database rebuild, ownership, anonymous-denial, and account-deletion parts of the Phase 7 gate are green. The remaining items require a selected hosting target and Git repository, so the complete Phase 7 exit gate is not yet certified.
