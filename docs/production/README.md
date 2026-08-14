# Typing Master production operations

This folder contains the durable operational contracts used to evaluate, deploy, and recover Typing Master. It intentionally excludes historical phase handoffs and one-off implementation reports.

The current release decision should be made from the evidence in the release checklist and the current CI/deployment status rather than from a hard-coded status line in documentation.

## Documents

- `ACCEPTANCE_MATRIX.md` — critical learner journeys, supported environments, and data-state checks.
- `NONFUNCTIONAL_GATES.md` — performance, accessibility, security, reliability, and observability budgets.
- `MIGRATION_ROLLBACK_RECOVERY.md` — data-change, deployment rollback, backup, and recovery rules.
- `RELEASE_CHECKLIST.md` — evidence-based go/no-go checklist.
- `ENVIRONMENT_MATRIX.md` — environment separation and secret ownership.
- `DEPLOYMENT_RUNBOOK.md` — deterministic build, deployment, promotion, and rollback procedures.
- `SECURITY_EXCEPTIONS.md` — reviewed temporary security exceptions with explicit expiry dates.

## Rules of use

1. Mark a release requirement complete only when supporting evidence exists.
2. “Works locally” is not sufficient evidence for account, sync, migration, or hosted-deployment behavior.
3. P0 and P1 defects block release; any lower-severity waiver should have an owner, reason, mitigation, and expiry.
4. Production data must not be used as test data.
5. Database migrations are forward-only during normal operation; rollback and recovery procedures should be rehearsed outside production.
6. A release should be reversible before it is promoted.
7. Keep CI, dependency policy, license policy, and deployment checks green before treating an artifact as releasable.
