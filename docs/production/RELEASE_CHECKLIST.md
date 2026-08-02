# Strict release go/no-go checklist

Release candidate: __________  
Source/commit ID: __________  
Build ID: __________  
Staging URL: __________  
Production URL: __________  
Decision date/time: __________  
Release owner: __________  
Rollback owner: __________

No item is checked without a linked artifact. Any failed mandatory item makes the decision **NO-GO**.

## 1. Scope and source

- [ ] Release scope and intentionally excluded work are written and approved.
- [ ] Exact source is in version control; working tree and release artifact are traceable.
- [ ] `.env.local`, tokens, service-role keys, and passwords are absent from source and artifacts.
- [ ] Package lock is current and the build is reproducible in CI.
- [ ] README, version, release notes, and production documents agree.

Evidence: __________

## 2. Automated gate

- [ ] Clean install succeeds on the supported Node version.
- [ ] Unit/regression tests pass with zero failures.
- [ ] Lint passes.
- [ ] Production build passes.
- [ ] Dependency audit has no unapproved critical/high finding.
- [ ] Schema migration, RLS, auth, sync, import, recovery, and account-deletion tests pass.
- [ ] Automated browser smoke tests pass against staging.

Evidence: __________

## 3. Database, auth, and data ownership

- [ ] A clean staging backend can be built entirely from repository migrations.
- [ ] RLS is enabled and two-account/anonymous isolation tests pass on every user-data table/view/RPC.
- [ ] Grants and function execution roles follow least privilege.
- [ ] Auth email confirmation and password-reset links use exact allowlisted URLs.
- [ ] Guest-to-account migration is idempotent and preserves account data.
- [ ] Account A/B switching exposes no cross-account local or cloud data.
- [ ] Signed-in account deletion, cascade verification, and local cleanup pass.
- [ ] Backup identifier is recorded and restore was rehearsed.

Evidence: __________

## 4. Critical learner journeys

- [ ] Every mandatory journey J-01 through J-20 in `ACCEPTANCE_MATRIX.md` is passed or explicitly not yet applicable.
- [ ] Lesson locking, staged mastery, cumulative review, and spaced review are correct.
- [ ] Diagnostic placement never credits an interrupted or ineligible learner.
- [ ] Practice presets, custom builder, long content, and result coaching are correct.
- [ ] Recovery followed by fresh reassessment is distinct and correctly reported.
- [ ] Assessment validity, estimates, levels, and personal bests are correct.
- [ ] Refresh/crash recovery restores only compatible incomplete sessions and never validates them.
- [ ] Export/import works with clean, mature, malformed, oversized, legacy, and future-version fixtures.
- [ ] Settings and completed sessions sync automatically; the learner never needs a sync button for normal changes.
- [ ] Offline practice/reconnect retains and uploads progress exactly once.

Evidence: __________

## 5. Desktop UX and accessibility

- [ ] Required macOS/Windows/browser/viewport/zoom matrix passes.
- [ ] Every screen has a clear purpose and one dominant next action.
- [ ] Keyboard-only navigation, visible focus, skip links, and Escape behavior pass.
- [ ] Loading, empty, success, invalid, offline, quota, auth-error, sync-error, and crash states are understandable and recoverable.
- [ ] Light/dark themes, reduced motion, 200% zoom, and text contrast pass.
- [ ] Screen-reader smoke tests cover onboarding, lesson, typing, result, settings, account, and errors.
- [ ] No mobile/touch support claim appears in release-facing copy.

Evidence: __________

## 6. Performance and endurance

- [ ] All build and runtime budgets in `NONFUNCTIONAL_GATES.md` pass.
- [ ] Key-to-paint p95 and timer-drift measurements pass.
- [ ] A 20-minute high-speed session completes without lost input, growing DOM, or material slowdown.
- [ ] A mature 1,000-summary/200-detail profile remains responsive.
- [ ] Slow/flaky network, offline queue, reconnect, and concurrent-device stress tests pass.
- [ ] Storage pressure and unavailable IndexedDB tests preserve core progress and inform the learner.

Evidence: __________

## 7. Hosting and security

- [ ] HTTPS, domain redirects, SPA/hash routes, and password-recovery routes pass.
- [ ] CSP, HSTS, frame, MIME, referrer, permissions, and cache headers are verified from production-like staging.
- [ ] Built assets contain no source secret or private environment value.
- [ ] Custom/imported text cannot execute markup or script.
- [ ] Security exception list is empty or every item is approved, owned, mitigated, and unexpired.

Evidence: __________

## 8. Monitoring, privacy, and support

- [ ] Production errors, auth availability, local-save failures, sync failures, and deployment health are monitored with release IDs.
- [ ] Test alerts reach the primary and backup owner.
- [ ] Monitoring payload review confirms no raw typed/custom text, email, token, password, or backup body.
- [ ] Privacy, retention, export, deletion, terms, and support information are published and accurate.
- [ ] Incident, data-request, and user-support drills pass.

Evidence: __________

## 9. Rollback and launch

- [ ] Previous immutable client artifact is available.
- [ ] Client rollback/forward-fix decision has been rehearsed against current data/schema.
- [ ] Database recovery strategy and recent backup are verified.
- [ ] Canary/closed-beta cohort, observation window, thresholds, and stop conditions are recorded.
- [ ] Release and rollback owners remain available throughout the observation window.
- [ ] P0 count is 0; P1 count is 0; every P2 waiver has owner, mitigation, and expiry.

Evidence: __________

## Final decision

- [ ] **GO** — all mandatory gates pass and rollback remains available.
- [ ] **NO-GO** — one or more mandatory gates failed or lacks evidence.

Open P0: _____  
Open P1: _____  
Waived P2: _____

Decision rationale: __________

Release owner signature/date: __________  
Security/data owner signature/date: __________  
QA owner signature/date: __________  
Rollback owner signature/date: __________

