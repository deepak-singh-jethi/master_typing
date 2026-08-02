# Production Phase 5 — foundation audit and acceptance contract

## Purpose

This phase converts “make it production ready” into evidence-based release gates. It changes documentation only; it does not claim that any production blocker has been fixed.

The application is desktop-only. The supported experience assumes a physical QWERTY keyboard and a desktop-class browser. Narrow/mobile layouts may remain usable, but they are outside the production support promise.

## Audit scope

Reviewed on 2026-08-01:

- Application routes and lazy loading.
- Onboarding, diagnostic, course, guided lessons, practice, tests, insights, settings, and account recovery.
- Typing engine, pause behavior, assessment validity, remediation, and interrupted-session recovery.
- LocalStorage summaries, IndexedDB details, backup import/export, storage pruning, and data versioning.
- Supabase authentication, guest-to-account migration, automatic sync, retry outbox, cross-device merge, and cloud payload minimisation.
- Error handling, accessibility scaffolding, package security, tests, build, source control, CI, deployment, monitoring, and operational documentation.

## Verified baseline

Command: `npm run check`

- Tests: **166 passed, 0 failed**.
- Lint: **passed**.
- Production build: **passed** with Vite 8.2.0.
- Initial application JavaScript: **132.70 kB gzip**.
- CSS: **11.23 kB gzip**.
- Largest content chunk: **37.80 kB gzip**.
- Build time in this environment: **961 ms**.

Dependency audit: `npm audit --omit=dev` reports two high-severity package entries arising from one React Router advisory (`GHSA-qwww-vcr4-c8h2`). The advisory states that only unstable RSC APIs are affected; this application uses `HashRouter` and does not use RSC APIs. This lowers observed exposure but does not satisfy the strict release policy. Phase 6 must either move to a patched supported line and pass regression or record a short-lived security exception with technical evidence and an expiry.

## What is already well designed

### Learning behavior

- The course progresses from home-row anchoring through reaches, whole-keyboard control, practical writing, and an assessment.
- Lesson mastery uses multiple exercise stages, fresh transfer evidence, and cumulative module checkpoints.
- Short checks are separated from longer proficiency assessments.
- Failed work can lead to targeted recovery followed by a separate fresh reassessment.

### Data safety foundations

- Guest and signed-in data use separate local keys.
- App changes save locally first; signed-in changes enqueue automatically after a 350 ms debounce.
- Sync failures retain an outbox and retry with bounded backoff; reconnect triggers a retry.
- Typed text is excluded from the compact cloud session payload.
- Interrupted typing is stored locally and restored paused when the exact session identity still matches.
- Imports reject unsupported future versions, oversized backups, and excessive session counts.

### Interface foundations

- Primary routes are lazy-loaded.
- Application and session shells include skip links and route announcements.
- Charts expose text alternatives, results receive focus, reduced motion is supported, and the app has a recoverable error boundary.
- Settings and account screens describe automatic backup; manual sync is only a recovery action after an error.

## Risk register

| ID | Severity | Finding | Required closure evidence | Target phase |
|---|---|---|---|---|
| PR-01 | P0 blocker | The repository contains only two incremental Supabase migrations, not the base tables, views, indexes, RLS policies, grants, triggers, and full `sync_typing_session` definition. A new environment cannot be reproduced or independently audited. | Complete schema/migrations in source; clean staging rebuild; RLS ownership tests with two users and anon; least-privilege grant review | 6 |
| PR-02 | P0 blocker | No source-control history or CI workflow is present in this workspace, so the exact release source and automated gate cannot be proven. | Version-controlled repository, protected mainline, reviewed CI running install/check/audit/build, immutable release identifier | 7 |
| PR-03 | P1 blocker | Signed-in account and cloud-data deletion is explicitly not implemented. | Re-authenticated deletion flow; server-side cascade verification; export-before-delete option; cancel and failure recovery; staging evidence | 6 |
| PR-04 | P1 blocker | The dependency audit reports a high React Router advisory. Current code does not use the affected unstable RSC APIs, but the installed line remains flagged. | Patched supported dependency with full regression, or approved time-limited exception documenting non-use, compensating controls, owner, and expiry | 6 |
| PR-05 | P1 blocker | Hosting is unspecified; CSP, HSTS, frame, MIME, referrer, permissions, and cache policies are not defined or verified. | Staging and production header report; asset/index cache policy; HTTPS and redirect proof; password-reset URL allowlist | 6-7 |
| PR-06 | P1 blocker | No staging/production separation or secrets/configuration inventory is recorded. | Environment matrix, separate Supabase projects, variable ownership, rotation procedure, redirect allowlists, release-time validation | 7 |
| PR-07 | P1 blocker | No automated end-to-end browser suite or completed manual desktop matrix exists. | Mandatory journeys pass on every supported browser/viewport/data state; artifacts attached to release | 8 |
| PR-08 | P1 blocker | Runtime errors are logged only to the browser console; no production error, sync-health, or release monitoring exists. | Privacy-safe monitoring, release tags, alert thresholds, owner, test alert, incident runbook | 9 |
| PR-09 | P1 blocker | No measured input-latency, timer-drift, memory/endurance, cold-load, or sync-recovery evidence exists on representative desktops. | Measurements meeting `NONFUNCTIONAL_GATES.md` with device/browser/build details | 9 |
| PR-10 | P1 blocker | Privacy notice, terms, retention description, data-subject contact, and support path are absent. | Reviewed user-facing documents that match the actual data inventory and account-deletion behavior | 10 |
| PR-11 | P1 blocker | Backup restore and database rollback have not been rehearsed in a staging environment. | Timestamped restore drill, migration rollback/forward-fix drill, measured RTO/RPO, named decision owner | 7 and 9 |
| PR-12 | P2 | Existing top-level README/validation documents report an older Phase 5 and stale test counts. | Documentation reconciled when the next implementation phase changes product status | 7 |
| PR-13 | P2 | Auth initialization converts failures into a signed-out state without preserving a visible cause. This can make an account-service outage look like normal guest mode. | Explicit unavailable/retry state; no accidental guest/account ambiguity; journey tests | 6 or 8 |
| PR-14 | P2 | Recovery and compact local storage catch corruption by falling back or removing stale data, but there is no user-visible corrupt-storage recovery path. | Corrupt/quota-denied states tested; clear explanation; export/repair/reset options where possible | 8-9 |

## Defect severity contract

- **P0 — stop immediately:** cross-account data exposure, auth bypass, irreversible data loss, corrupted mastery/assessment at scale, secret exposure, or production unavailable for all users. No release or continued rollout.
- **P1 — release blocker:** a critical journey fails, offline/sync/recovery loses progress, account deletion fails, results are materially wrong, or a required browser is unusable. Zero open P1 defects at go/no-go.
- **P2 — major:** important functionality has a safe workaround, material accessibility/performance problem, or confusing behavior likely to cause abandonment. A release waiver requires owner, mitigation, and expiry.
- **P3 — minor:** cosmetic or low-impact inconsistency. May ship only when documented and not concentrated in a core typing flow.

## Exact execution order after Phase 5

### Phase 6 — security and data ownership

1. Capture the complete Supabase schema and RLS policies as migrations.
2. Build automated two-account and anonymous-access RLS tests.
3. Resolve the React Router advisory without using an automatic forced downgrade.
4. Implement signed-in account deletion and verify cloud cascade behavior.
5. Add visible auth-service failure handling and approved browser security headers.
6. Re-run all unit, sync, migration, and recovery tests.

Exit: PR-01, PR-03, PR-04, PR-05, and PR-13 are closed; no open P0/P1 security issue.

### Phase 7 — release engineering

1. Put the project under source control without committing `.env.local`.
2. Add deterministic CI and dependency/license/security checks.
3. Create separate staging and production configuration and Supabase projects.
4. Define immutable build/version identifiers, deployment ownership, cache rules, and rollback commands.
5. Rebuild staging from migrations and rehearse deploy plus rollback.

Exit: any approved source change produces the same checked artifact; staging can be rebuilt and rolled back by the runbook.

### Phase 8 — strict functional and desktop UX QA

1. Automate stable browser journeys first.
2. Execute every row in `ACCEPTANCE_MATRIX.md` manually where human judgment is required.
3. Test keyboard-only operation, focus, zoom, long content, empty/loading/error states, account switching, offline/reconnect, and refresh recovery.
4. Fix behavior defects before aesthetic refinements.

Exit: all mandatory matrix cells pass and there are zero open P0/P1 defects.

### Phase 9 — performance, reliability, and observability

1. Measure the budgets in `NONFUNCTIONAL_GATES.md` on representative macOS and Windows desktops.
2. Stress 20-minute typing, 1,000-session history, storage pressure, slow/flaky networking, and concurrent device changes.
3. Add privacy-safe error and sync-health monitoring with release tags and alerts.
4. Run backup restore, incident notification, and rollback drills.

Exit: budgets pass, alerts reach an owner, and recovery drills meet the recorded objectives.

### Phase 10 — privacy, support, and operations

1. Freeze and verify the data inventory.
2. Publish privacy, retention, terms, account-deletion, and support information.
3. Create incident, data request, and user-support procedures.
4. Check every claim against real product behavior.

Exit: legal/operational copy and product behavior agree; a support drill succeeds.

### Phase 11 — release candidate and controlled launch

1. Freeze an RC and run `RELEASE_CHECKLIST.md` from clean and upgrade states.
2. Conduct a small controlled beta with monitoring and an active rollback owner.
3. Review defects and operational signals before broadening access.
4. Sign a final go/no-go record.

Exit: the release record is complete, no blocker is open, monitoring is healthy, and rollback remains available.

## Phase 5 decision

The project is **going in the planned direction**. The next safe move is Phase 6, not additional course or visual expansion. Production approval remains withheld until the release checklist is fully evidenced.

