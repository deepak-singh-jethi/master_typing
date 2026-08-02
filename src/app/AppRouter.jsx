import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { SessionShell } from "@/components/layout/SessionShell";

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const AccountPage = lazyNamed(() => import("@/pages/AccountPage"), "AccountPage");
const ResetPasswordPage = lazyNamed(() => import("@/pages/ResetPasswordPage"), "ResetPasswordPage");
const DashboardPage = lazyNamed(() => import("@/pages/DashboardPage"), "DashboardPage");
const DiagnosticPage = lazyNamed(() => import("@/pages/DiagnosticPage"), "DiagnosticPage");
const ForgotPasswordPage = lazyNamed(() => import("@/pages/ForgotPasswordPage"), "ForgotPasswordPage");
const InsightsPage = lazyNamed(() => import("@/pages/InsightsPage"), "InsightsPage");
const LearnPage = lazyNamed(() => import("@/pages/LearnPage"), "LearnPage");
const LessonPage = lazyNamed(() => import("@/pages/LessonPage"), "LessonPage");
const NotFoundPage = lazyNamed(() => import("@/pages/NotFoundPage"), "NotFoundPage");
const PracticePage = lazyNamed(() => import("@/pages/PracticePage"), "PracticePage");
const PracticeSessionPage = lazyNamed(() => import("@/pages/PracticeSessionPage"), "PracticeSessionPage");
const SettingsPage = lazyNamed(() => import("@/pages/SettingsPage"), "SettingsPage");
const TestSessionPage = lazyNamed(() => import("@/pages/TestSessionPage"), "TestSessionPage");
const TestsPage = lazyNamed(() => import("@/pages/TestsPage"), "TestsPage");
const WelcomePage = lazyNamed(() => import("@/pages/WelcomePage"), "WelcomePage");

function RouteFallback() {
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400">
        <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
        Loading page…
      </div>
    </div>
  );
}

export function AppRouter() {
  return (
    <HashRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="welcome" element={<WelcomePage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />

          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="learn" element={<LearnPage />} />
            <Route path="learn/:lessonId" element={<LessonPage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="tests" element={<TestsPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route element={<SessionShell />}>
            <Route path="practice/session" element={<PracticeSessionPage />} />
            <Route path="tests/:testId" element={<TestSessionPage />} />
            <Route path="diagnostic" element={<DiagnosticPage />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
