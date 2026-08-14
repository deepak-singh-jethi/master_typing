export const PAGE_META = [
  { match: (path) => path === "/welcome", title: "Set up", description: "Choose your starting point and goal" },
  { match: (path) => path === "/diagnostic", title: "Diagnostic", description: "Find a safe starting lesson" },
  { match: (path) => path === "/practice/session", title: "Practice session", description: "Focused typing in progress" },
  { match: (path) => path.startsWith("/tests/"), title: "Typing assessment", description: "Comparable pace and accuracy measurement" },
  { match: (path) => path === "/forgot-password", title: "Reset password", description: "Request a secure recovery link" },
  { match: (path) => path === "/reset-password", title: "Choose password", description: "Set a new account password" },
  { match: (path) => path === "/", title: "Today", description: "Your next best typing action" },
  { match: (path) => path === "/learn", title: "Learn", description: "Build correct movement step by step" },
  { match: (path) => path.startsWith("/learn/"), title: "Lesson", description: "Focused guided practice" },
  { match: (path) => path.startsWith("/review/"), title: "Spaced review", description: "Check retained movement without replaying the lesson" },
  { match: (path) => path === "/practice", title: "Practice", description: "Choose a focused session" },
  { match: (path) => path === "/tests", title: "Tests", description: "Check progress or assess your level" },
  { match: (path) => path === "/insights", title: "Insights", description: "Understand what is improving" },
  { match: (path) => path === "/settings", title: "Settings", description: "Comfort, storage, and privacy" },
  { match: (path) => path === "/account", title: "Account", description: "Sign in and automatic backup" },
];

export function getPageMeta(pathname = "/") {
  return PAGE_META.find((item) => item.match(pathname)) ?? {
    title: "Typing Master",
    description: "Focused typing practice",
  };
}

export function getPrimaryDashboardAction({ onboardingCompleted, nextLesson = null }) {
  if (!onboardingCompleted) {
    return {
      kind: "setup",
      eyebrow: "Start here",
      title: "Set up your learning path",
      description: "Choose your experience, goal, and a realistic daily practice time.",
      label: "Set up my path",
      to: "/welcome",
    };
  }

  if (nextLesson) {
    return {
      kind: "lesson",
      eyebrow: `Lesson ${nextLesson.number}`,
      title: nextLesson.title,
      description: nextLesson.subtitle || "Continue the guided learning path.",
      label: "Continue lesson",
      to: `/learn/${nextLesson.id}`,
    };
  }

  return {
    kind: "benchmark",
    eyebrow: "Foundation complete",
    title: "Assess your course level",
    description: "You have completed the learning path. Use a sustained assessment when you want a comparable measure of pace and accuracy.",
    label: "Start assessment",
    to: "/tests/consistency-180",
  };
}

export function getDashboardReviewAction(reviewQueue = []) {
  const review = reviewQueue[0];
  if (!review) return null;

  return {
    kind: "review",
    eyebrow: "Review due",
    title: review.lesson?.title || "Earlier lesson",
    description: "Quick retention check for a lesson you have already mastered.",
    label: "Start review",
    to: `/review/${review.lessonId}`,
    dueCount: reviewQueue.length,
    dueAt: review.mastery?.dueAt ?? null,
  };
}

export function getPlanCompletionLabel({ completedMinutes = 0, goalMinutes = 0 }) {
  const completed = Math.max(0, Number(completedMinutes) || 0);
  const goal = Math.max(0, Number(goalMinutes) || 0);
  if (goal === 0) return "No daily target";
  if (completed >= goal) return "Daily goal complete";
  return `${Math.max(0, goal - completed)} minutes remaining`;
}
