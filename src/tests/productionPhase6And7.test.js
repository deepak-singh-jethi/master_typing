import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("the complete cloud baseline defines every user table with cascade ownership and RLS", () => {
  const sql = read("supabase/migrations/20260801090000_typing_app_schema_baseline.sql");
  for (const table of ["profiles", "user_settings", "user_progress", "lesson_mastery", "session_summaries", "daily_activity", "skill_aggregates", "sync_state"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.%I enable row level security`));
  }
  assert.match(sql, /references auth\.users\(id\) on delete cascade/g);
  assert.match(sql, /to authenticated using \(\(select auth\.uid\(\)\) = user_id\) with check/);
  assert.match(sql, /revoke all on public\.%I from anon, authenticated/);
});

test("account deletion requires a fresh JWT, matching user, and service-side admin deletion", () => {
  const edge = read("supabase/functions/delete-account/index.ts");
  const auth = read("src/context/AuthProvider.jsx");
  const account = read("src/pages/AccountPage.jsx");
  assert.match(edge, /ageSeconds > 5 \* 60/);
  assert.match(edge, /body\.userId !== user\.id/);
  assert.match(edge, /auth\.admin\.deleteUser\(user\.id\)/);
  assert.match(auth, /signInWithPassword/);
  assert.match(auth, /functions\.invoke\("delete-account"/);
  assert.match(account, /Type DELETE to confirm/);
  assert.match(account, /Export progress/);
  assert.match(account, /clearDeletedAccountData/);
});

test("auth initialization failures remain visible and recoverable", () => {
  const auth = read("src/context/AuthProvider.jsx");
  const banner = read("src/components/layout/AppStatusBanner.jsx");
  assert.match(auth, /serviceError/);
  assert.match(auth, /retryService/);
  assert.match(banner, /Account service is unavailable/);
  assert.match(banner, /Retry account service/);
});

test("release engineering files enforce CI, immutable build identity, headers, and safe examples", () => {
  for (const path of [".github/workflows/ci.yml", ".nvmrc", "vercel.json", "public/_headers", ".env.staging.example", ".env.production.example"]) {
    assert.equal(existsSync(new URL(path, root)), true, `${path} must exist`);
  }
  const workflow = read(".github/workflows/ci.yml");
  const headers = read("vercel.json");
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm run release:check/);
  assert.match(workflow, /VITE_BUILD_ID/);
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /max-age=31536000, immutable/);
  assert.match(headers, /max-age=0, must-revalidate/);
});
