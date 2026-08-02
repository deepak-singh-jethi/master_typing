# Typing Master production-readiness plan

Status: **Phase 7 backend staging evidence passed; hosting and repository controls pending; product not yet approved for production**
Audited version: `0.5.1`  
Audit date: 2026-08-01  
Product boundary: desktop web application using a physical keyboard

This folder is the authoritative production-readiness contract. The root-level `PHASE_5.md` describes an earlier UI phase and is retained as historical documentation.

## Current decision

The learning engine is a strong pre-production foundation, but the application is a **NO-GO for public production** until the release blockers in `PRODUCTION_PHASE_5_FOUNDATION.md` are closed.

Current strengths:

- 27-lesson progressive curriculum with guided, transfer, cumulative review, and proficiency evidence.
- Local-first guest mode, isolated account caches, automatic cloud sync, an offline outbox, and interrupted-session recovery.
- Export/import, compact history, detailed local telemetry, and data-version validation.
- A clean automated baseline: 181 tests, lint, production build, dependency policy, and license policy all pass.

Current release blockers include:

- The isolated staging backend is proven, but a hosted staging URL is still needed for response-header, redirect, client rollback, and backup/restore drills.
- A Git remote and protected-main rules are not configured yet.
- Supabase leaked-password protection still needs enabling in the Auth dashboard.
- Runtime monitoring, strict desktop/browser QA, non-functional measurements, privacy/support material, and controlled-launch evidence belong to Phases 8–11.
- The remaining React Router RSC-only advisory is governed by a pinned, expiring exception in `SECURITY_EXCEPTIONS.md`.
- The supported desktop browser and data-state matrix has not yet been manually executed.

## Ordered production phases

| Phase | Outcome | Starts only when | Exit gate |
|---|---|---|---|
| 5. Foundation and acceptance contract | Inventory, risk register, measurable gates, rollback rules | Complete | These documents exist and the baseline check passes |
| 6. Security and data ownership | Reproducible cloud schema/RLS, account deletion, security headers, dependency resolution | Phase 5 accepted | No open P0/P1 security or data-ownership defect; destructive paths proven in staging |
| 7. Release engineering | Source control, protected mainline, CI, staging, production configuration, deployment runbook | Phase 6 database contracts stable | Every change produces a reproducible tested artifact; staging deployment and rollback succeed |
| 8. Strict functional and desktop UX QA | Execute every critical journey across browser, resolution, zoom, keyboard, auth, offline, and recovery states | Stable staging build | All mandatory matrix cells pass; zero open P0/P1 defects |
| 9. Performance, reliability, and observability | Meet input, load, endurance, sync, storage, monitoring, and alerting budgets | Phase 8 flows stable | Budgets pass on representative hardware; alerts and recovery drills are proven |
| 10. Privacy, support, and operational readiness | Data inventory, user-facing policies, support/contact path, retention and incident procedures | Data behavior frozen | Product copy and operations match actual data handling; support drill passes |
| 11. Release candidate and controlled launch | Frozen RC, clean-user and upgrade rehearsals, canary/closed beta, final go/no-go | Phases 6-10 green | Signed release checklist, rollback owner available, monitored launch approved |

Phases are deliberately ordered. UI polish is not a substitute for data safety; broad manual QA should not begin until security and deployment behavior are stable.

## Production documents

- `PRODUCTION_PHASE_5_FOUNDATION.md` — audit, decisions, risks, and phased execution path.
- `ACCEPTANCE_MATRIX.md` — routes, critical learner journeys, desktop environments, and data states.
- `NONFUNCTIONAL_GATES.md` — performance, accessibility, security, reliability, and observability budgets.
- `MIGRATION_ROLLBACK_RECOVERY.md` — data change, deployment rollback, backup, and recovery rules.
- `RELEASE_CHECKLIST.md` — strict evidence-based go/no-go checklist.
- `NEXT_SESSION.md` — durable handoff for resuming Phase 6 after the lesson-content correction.
- `PHASE_6_7_REPORT.md` — implemented security/release controls, live evidence, and external staging blockers.
- `ENVIRONMENT_MATRIX.md` — separation and secret ownership.
- `DEPLOYMENT_RUNBOOK.md` — deterministic build, promotion, and rollback steps.
- `SECURITY_EXCEPTIONS.md` — strict expiring advisory register.

## Rules of use

1. A checkbox is marked only when linked evidence exists.
2. “Works locally” is not release evidence for an account, sync, migration, or deployment change.
3. P0 and P1 defects block release. A waived P2 requires an owner, reason, expiry date, and mitigation.
4. Production data is never used as test data.
5. Database migrations are forward-only in normal operation; rollback is rehearsed in staging before production.
6. A release is reversible before it is deployable.
