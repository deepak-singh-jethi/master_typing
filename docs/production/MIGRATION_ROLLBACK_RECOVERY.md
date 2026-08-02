# Migration, rollback, and recovery contract

## Current versioned state

- Application package: `0.5.1`.
- Local data: version 9.
- Curriculum: version 2.
- Guided content: version 1.
- Proficiency standard: version 1.
- Supabase source currently contains only two incremental migrations; the complete baseline schema is a release blocker.

## Change classes

Every production change declares one class before implementation:

1. **Client-only reversible** — UI/copy/logic change with no stored-data change.
2. **Client data migration** — changes LocalStorage, IndexedDB, recovery snapshots, imports, or compact summaries.
3. **Cloud additive** — new nullable column/table/index/policy/function version that older clients can safely ignore.
4. **Cloud breaking** — rename/drop/type/constraint/RPC behavior change or policy change that older clients cannot safely use.
5. **Security emergency** — active exposure requiring immediate containment, dependency/config change, or feature disablement.

Class 4 work requires an expand-migrate-contract plan and cannot be combined with an unrelated feature release.

## Migration design rules

- Commit the complete schema and every change as an ordered migration. Manual dashboard-only changes are prohibited.
- Prefer additive schema changes and versioned RPCs.
- Keep old and new clients compatible through the rollout window.
- Make migrations idempotent where practical and fail loudly when preconditions differ.
- Back up before destructive or type-changing work.
- Test empty, typical, maximum, legacy, malformed, and cross-device records.
- Verify RLS/grants after every schema/function change; a successful SQL migration is not sufficient.
- Version changed curriculum/mastery semantics so old evidence remains interpretable.
- Never clear a local or cloud outbox until the server confirms the intended session IDs and snapshot revision.

## Required pre-deployment evidence

For any client-data or cloud change:

- Source and target version.
- Exact affected keys/tables/columns/functions/policies.
- Record-count and integrity queries before/after.
- Forward test on a clean state and every supported prior state.
- Failure injected halfway through the change.
- Repeat execution test.
- Old-client behavior during rollout.
- Backup identifier and restore command/runbook.
- Rollback or forward-fix decision, owner, and time limit.

## Deployment sequence

1. Freeze the release candidate and record source/build IDs.
2. Confirm recent backup and successful restore drill.
3. Apply additive backend changes to staging.
4. Run RLS, RPC, two-account, migration, and critical-journey tests.
5. Deploy client to staging and run the release checklist.
6. Apply production backend change only inside the approved window.
7. Verify counts, policies, auth, session sync, and alert health.
8. Deploy the production client gradually where the host supports it.
9. Watch P0/P1 signals through the defined observation window.
10. Complete contract/drop cleanup only in a later release after old clients are outside the support window.

## Rollback rules

### Client rollback

Roll back the client immediately for a P0 or a release-caused widespread P1 only when the previous client can safely read the current data/schema. Otherwise disable the affected path and issue a forward fix.

Required client rollback proof:

- Previous immutable artifact is available.
- Asset and `index.html` cache behavior serves a coherent version.
- The previous client reads data written by the RC.
- Password-recovery and hash routes still resolve.
- Monitoring confirms recovery after rollback.

### Database rollback

- Do not reverse a migration that would discard learner data.
- For additive changes, prefer leaving the schema and rolling back application use.
- For unsafe constraints/policies/functions, deploy a reviewed corrective migration.
- Restore from backup only for confirmed corruption or loss, with incident leadership approval and reconciliation for writes after the backup.

### Security containment

Containment may include disabling account creation, cloud sync, a vulnerable route, or the full deployment. Guest local practice may remain available only when it is proven independent of the incident.

## Recovery drills required before RC

| Drill | Pass condition |
|---|---|
| Clean environment rebuild | New staging Supabase project is created entirely from repository migrations and configuration |
| Two-account RLS attack test | User A/anon cannot read or mutate any User B row or invoke RPC against it |
| Failed sync/RPC | Local state/outbox remains intact, error is visible, retry later succeeds exactly once |
| Offline 20-minute session | Completion saves locally, refresh is safe, reconnect syncs without duplicates |
| LocalStorage corruption | App avoids a crash loop and offers a safe recovery path |
| IndexedDB/quota failure | Compact completion remains safe and the learner is clearly warned |
| Interrupted migration | Re-running reaches one valid state without duplicate aggregates |
| Backup restore | Staging restore meets recorded RPO/RTO and passes integrity queries |
| Bad client release | Previous artifact or forward fix restores critical journeys within RTO |
| Account deletion | All owned cloud rows and local scopes are removed; another account is unaffected |

## Release evidence record

Every migration/recovery record includes date, environment, release ID, migration IDs, backup ID, executor, reviewer, pre/post counts, test artifacts, observed duration, decision, defects, and final approval.

