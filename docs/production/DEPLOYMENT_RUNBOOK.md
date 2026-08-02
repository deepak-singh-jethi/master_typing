# Deployment and rollback runbook

## Release inputs

- Node 22.12.0 from `.nvmrc`.
- Exact dependency graph from `package-lock.json`.
- Commit SHA supplied as `VITE_BUILD_ID`.
- Separate staging and production Supabase URL/publishable key.
- Database migrations in lexical order and versioned Edge Functions in `supabase/functions`.

## Build and verify

1. Start from a clean checkout of the release commit.
2. Run `npm ci --ignore-scripts`.
3. Run `npm run release:check`.
4. Build with `VITE_BUILD_ID=<commit-sha> npm run build`.
5. Store the `dist` directory as an immutable artifact named with the commit SHA.
6. Confirm the artifact contains no `.env*`, secret/service-role key, or source map unless separately approved.

## Staging deployment

1. Confirm a current backup and record its identifier.
2. Rebuild the staging Supabase project from repository migrations.
3. Deploy `delete-account` with JWT verification enabled.
4. Run `supabase/tests/rls_ownership.sql` and the account A/B isolation journey.
5. Configure exact staging confirmation/reset redirect URLs.
6. Deploy the immutable client artifact with the staging variables.
7. Verify response headers, asset caching, auth, automatic sync, offline recovery, deletion, and hash routes.

## Production promotion

1. Approve the tested staging commit and artifact checksum.
2. Apply only reviewed additive database migrations.
3. Deploy the same Edge Function source and verify JWT enforcement.
4. Promote the exact staged client artifact; do not rebuild from another working tree.
5. Verify build ID, owner isolation, sync, password reset, and account deletion.

## Rollback

- Client: redeploy the previous immutable artifact only if it can read the current additive schema.
- Database: retain additive objects and deploy a reviewed forward-fix migration; do not drop learner data.
- Edge Function: redeploy the previous known-good version, or disable the deletion action in the client if ownership verification is uncertain.
- Stop immediately for cross-account exposure, secret exposure, irreversible data loss, or widespread auth failure.

The staging rebuild, backup restore, and production rollback are operational drills. They cannot be marked passed until a separately provisioned staging project and deployment URL exist.
