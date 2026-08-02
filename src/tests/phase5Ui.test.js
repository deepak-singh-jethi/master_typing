import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("application and session shells expose keyboard skip links and focusable main targets", () => {
  const appShell = source("components/layout/AppShell.jsx");
  const sessionShell = source("components/layout/SessionShell.jsx");
  assert.match(appShell, /href="#main-content"/);
  assert.match(appShell, /id="main-content"/);
  assert.match(sessionShell, /href="#session-content"/);
  assert.match(sessionShell, /id="session-content"/);
});

test("route changes are announced and update the document title", () => {
  const announcer = source("components/layout/RouteAnnouncer.jsx");
  assert.match(announcer, /aria-live="polite"/);
  assert.match(announcer, /document\.title/);
});

test("shared buttons default to a safe non-submit type", () => {
  const button = source("components/common/Button.jsx");
  assert.match(button, /type \|\| "button"/);
});

test("visual charts provide text alternatives", () => {
  for (const file of [
    "components/insights/WeeklyActivityChart.jsx",
    "components/insights/AttemptTrendChart.jsx",
    "components/typing/PaceChart.jsx",
    "components/insights/KeyHeatmap.jsx",
  ]) {
    assert.match(source(file), /role="img"/);
    assert.match(source(file), /aria-label=/);
  }
});

test("mobile typing avoids the oversized physical keyboard while preserving the next-key cue", () => {
  const keyboard = source("components/typing/OnScreenKeyboard.jsx");
  const workspace = source("components/typing/TypingWorkspace.jsx");
  assert.match(keyboard, /className="hidden[^"]*sm:block/);
  assert.match(workspace, /sm:hidden">Next:/);
});

test("account and settings describe automatic backup without requiring a sync button", () => {
  const account = source("pages/AccountPage.jsx");
  const settings = source("pages/SettingsPage.jsx");
  const provider = source("context/AppProvider.jsx");
  assert.doesNotMatch(account, />Sync now</);
  assert.doesNotMatch(settings, />Sync now</);
  assert.match(account, /backed up automatically/);
  assert.match(settings, /backed up automatically/);
  assert.match(provider, /AUTO_SYNC_DELAY_MS = 350/);
});

test("desktop shells keep one backup indicator and a consistent focused width", () => {
  const header = source("components/layout/Header.jsx");
  const sidebar = source("components/layout/Sidebar.jsx");
  const appShell = source("components/layout/AppShell.jsx");
  const sessionShell = source("components/layout/SessionShell.jsx");
  assert.match(header, /LocalModeBadge/);
  assert.doesNotMatch(sidebar, /LocalModeBadge/);
  assert.match(appShell, /max-w-\[1180px\]/);
  assert.match(sessionShell, /max-w-\[1180px\]/);
  assert.doesNotMatch(sessionShell, /max-w-\[1320px\]/);
});

test("practice sessions persist their recipe immediately so refresh uses the same setup", () => {
  const session = source("pages/PracticeSessionPage.jsx");
  assert.match(session, /useEffect\(\(\) => \{\s*saveLastPracticeConfig\(config\)/);
});

test("unfinished typing is persisted when an in-app route unmounts the session", () => {
  const session = source("hooks/useTypingSession.js");
  assert.match(session, /return \(\) => \{\s*persistRecovery\(\);\s*window\.removeEventListener\("pagehide"/);
});

test("account reconciliation queues only pending sessions instead of the full history", () => {
  const provider = source("context/AppProvider.jsx");
  assert.match(provider, /const sessionIdsToSync = new Set\(pendingBeforePull\.sessionIds\.map\(String\)\)/);
  assert.match(provider, /sessionIds: \[\.\.\.sessionIdsToSync\]/);
  assert.doesNotMatch(provider, /sessionIds: accountData\.attempts\.map/);
});

test("account and storage actions report failures instead of leaving rejected promises", () => {
  const account = source("pages/AccountPage.jsx");
  const settings = source("pages/SettingsPage.jsx");
  assert.match(account, /await auth\.signOut\(\)/);
  assert.match(account, /setAccountError\(error\.message/);
  assert.match(settings, /await pruneHistory\(\{ keep: 50 \}\)/);
  assert.match(settings, /Old session details could not be pruned/);
});

test("invalid test links provide a route back to the test list", () => {
  const session = source("pages/TestSessionPage.jsx");
  assert.match(session, /to="\/tests"/);
  assert.match(session, /Return to tests/);
});

test("practice keeps useful custom-text actions visible and removes the permanently hidden side panel", () => {
  const practice = source("pages/PracticePage.jsx");
  assert.doesNotMatch(practice, /className="hidden space-y-6"/);
  assert.match(practice, /Save or reuse practice text/);
  assert.match(practice, /Choose saved practice text/);
  assert.match(practice, /Delete selected saved text/);
  assert.doesNotMatch(practice, /getContentBankStats/);
});

test("every custom expandable control identifies the region it reveals", () => {
  const practice = source("pages/PracticePage.jsx");
  const workspace = source("components/typing/TypingWorkspace.jsx");
  for (const id of ["custom-session-builder", "more-practice-presets", "advanced-practice-controls"]) {
    assert.match(practice, new RegExp(`aria-controls="${id}"`));
    assert.match(practice, new RegExp(`id="${id}"`));
  }
  assert.match(workspace, /aria-controls="keyboard-guide"/);
  assert.match(workspace, /id="keyboard-guide"/);
});

test("the core learning path explains placement credit and links course progress to the course", () => {
  const learn = source("pages/LearnPage.jsx");
  const sidebar = source("components/layout/Sidebar.jsx");
  assert.match(learn, />PLACEMENT CREDIT</);
  assert.match(learn, /placement credits/);
  assert.match(sidebar, /<Link to="\/learn"/);
  assert.match(sidebar, /Open learning path/);
});

test("lesson mode, length, and fresh-text controls stay attached to the typing workspace", () => {
  const lesson = source("pages/LessonPage.jsx");
  const workspace = source("components/typing/TypingWorkspace.jsx");
  assert.match(lesson, /sessionControls=\{sessionControls\}/);
  assert.match(lesson, /showSessionNav=\{false\}/);
  assert.match(lesson, />Mode</);
  assert.match(lesson, /label="Length"/);
  assert.match(lesson, /<Button[^>]*onClick=\{resetGeneratedText\}[^>]*>[\s\S]*?New text[\s\S]*?<\/Button>/);
  assert.match(lesson, /role="group" aria-label=\{label\}/);
  assert.match(lesson, /aria-pressed=\{active\}/);
  assert.match(workspace, /\{sessionControls\}/);
});

test("technical storage controls are collapsed and account errors use alert semantics", () => {
  const settings = source("pages/SettingsPage.jsx");
  const account = source("pages/AccountPage.jsx");
  assert.match(settings, /<details className=/);
  assert.match(settings, /Advanced storage controls/);
  assert.match(account, /messageTone === "error" \? "alert" : "status"/);
});


test("the application provides a recoverable crash screen", () => {
  const app = source("App.jsx");
  const boundary = source("components/common/AppErrorBoundary.jsx");
  assert.match(app, /AppErrorBoundary/);
  assert.match(boundary, /Your saved progress has not been deleted/);
  assert.match(boundary, /window\.location\.reload/);
});

test("authentication forms use explicit submit buttons", () => {
  const account = source("pages/AccountPage.jsx");
  const reset = source("pages/ResetPasswordPage.jsx");
  assert.match(account, /<Button type="submit" variant="brand" className="w-full"/);
  assert.match(reset, /<Button type="submit" variant="brand" disabled=\{busy\}>/);
});
