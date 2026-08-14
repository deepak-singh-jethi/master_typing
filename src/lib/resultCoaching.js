const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, asNumber(value)));

function rounded(value, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(asNumber(value) * multiplier) / multiplier;
}

function normaliseType(value) {
  const type = String(value || "practice");
  if (type === "lesson-practice") return "lesson-practice";
  if (type === "lesson") return "lesson";
  if (type === "diagnostic") return "diagnostic";
  if (type === "test") return "test";
  return "practice";
}

export function getComparableSessionKey(session = {}) {
  const type = normaliseType(session.type);
  if (type === "test" || type === "diagnostic") {
    return [
      type,
      session.testId || session.modeId || "benchmark",
      Math.max(0, Math.round(asNumber(session.durationSeconds))),
    ].join("|");
  }

  if (type === "lesson" || type === "lesson-practice") {
    const practiceMode = session.practiceMode || session.modeId || "guided";
    const goalValue = practiceMode === "longer"
      ? Math.max(0, Math.round(asNumber(session.wordCount)))
      : Math.max(0, Math.round(asNumber(session.plannedDurationSeconds ?? session.durationSeconds)));
    return [
      type,
      session.lessonId || "lesson",
      practiceMode,
      practiceMode === "guided" ? session.exerciseId || "exercise" : "all",
      goalValue,
    ].join("|");
  }

  return [
    "practice",
    session.contentType || session.modeId || "words",
    session.practicePurpose || session.purpose || "balanced",
    session.goalType || (session.durationSeconds ? "time" : "words"),
    session.goalType === "words"
      ? Math.max(0, Math.round(asNumber(session.wordCount)))
      : Math.max(0, Math.round(asNumber(session.plannedDurationSeconds ?? session.durationSeconds))),
    session.category || "general",
    session.documentStyle || "mixed",
    session.difficulty || "balanced",
    session.progressiveFeatures ? "progressive" : "manual",
    session.punctuation ? "punctuation" : "plain",
    session.capitals ? "capitals" : "lowercase",
    session.numbers ? "numbers" : "no-numbers",
  ].join("|");
}

function getAccuracy(session = {}) {
  return clamp(session.keystrokeAccuracy ?? session.accuracy, 0, 100);
}

function getComparableCandidate(attempts = [], currentMeta = {}) {
  const key = getComparableSessionKey(currentMeta);
  const currentId = currentMeta.id ? String(currentMeta.id) : null;
  return [...attempts]
    .filter((item) => item && (!currentId || String(item.id) !== currentId))
    .filter((item) => getComparableSessionKey(item) === key)
    .sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")))[0] ?? null;
}

function metricDelta(current, previous, suffix = "") {
  const delta = rounded(asNumber(current) - asNumber(previous));
  return {
    delta,
    direction: delta > 0.05 ? "up" : delta < -0.05 ? "down" : "same",
    label: `${delta > 0 ? "+" : ""}${delta}${suffix}`,
  };
}

export function buildSessionComparison(result = {}, attempts = [], currentMeta = {}) {
  const previous = getComparableCandidate(attempts, currentMeta);
  if (!previous) return null;

  const metrics = {
    netWpm: metricDelta(result.netWpm, previous.netWpm, " WPM"),
    accuracy: metricDelta(getAccuracy(result), getAccuracy(previous), "%"),
    consistency: metricDelta(result.consistency, previous.consistency, "%"),
    completion: metricDelta(result.completion, previous.completion, "%"),
  };

  const speedImproved = metrics.netWpm.delta >= 1;
  const accuracyImproved = metrics.accuracy.delta >= 0.5;
  const accuracyDropped = metrics.accuracy.delta <= -0.5;
  const speedDropped = metrics.netWpm.delta <= -1;

  let headline = "Performance stayed close to your previous comparable session";
  let summary = "Small changes are normal. Keep the same setup for another attempt before changing difficulty.";
  if (speedImproved && accuracyImproved) {
    headline = "Faster and more accurate than last time";
    summary = "This is a strong improvement because speed increased without trading away control.";
  } else if (speedImproved && accuracyDropped) {
    headline = "Faster, but accuracy fell";
    summary = "The extra pace came with more errors. Repeat the same setup and keep the first minute controlled.";
  } else if (speedDropped && accuracyImproved) {
    headline = "Slower, but more accurate";
    summary = "The control improved. Keep this accuracy and allow speed to return gradually.";
  } else if (speedDropped && accuracyDropped) {
    headline = "Both speed and accuracy were lower";
    summary = "Fatigue or difficult content may be affecting the result. Use a short recovery session before another comparison.";
  } else if (accuracyImproved) {
    headline = "Accuracy improved at a similar pace";
    summary = "This is useful progress. Repeat once more before raising the difficulty.";
  } else if (speedImproved) {
    headline = "Speed improved while control stayed stable";
    summary = "The pace gain is credible because accuracy remained close to the previous result.";
  }

  return {
    previous,
    metrics,
    headline,
    summary,
    previousCompletedAt: previous.completedAt || null,
  };
}

export function getPrimaryDiagnosis({
  result = {},
  passed = false,
  passAccuracy = 0,
  requireComplete = false,
  resultContext = null,
} = {}) {
  const validationReasons = result.validationReasons?.length
    ? result.validationReasons
    : result.invalidReasons ?? [];
  const valid = result.validSession !== false && result.benchmarkValid !== false;
  const accuracy = getAccuracy(result);
  const completion = clamp(result.completion, 0, 100);
  const consistency = clamp(result.consistency, 0, 100);
  const correctionRate = clamp(result.correctionRate, 0, 100);
  const difficultKeys = result.difficultKeys ?? [];
  const difficultBigrams = result.difficultBigrams ?? [];
  const mistakeWords = result.mistakeWords ?? [];

  if (!valid) {
    return {
      tone: "amber",
      code: "invalid",
      eyebrow: "Session integrity",
      title: "This attempt is useful practice, but not a valid benchmark",
      summary: validationReasons[0] || "The session was interrupted, paused too much, or did not meet the benchmark requirements.",
      action: "Use the same test settings and complete one uninterrupted attempt.",
    };
  }

  if (requireComplete && completion < 99.9) {
    return {
      tone: "amber",
      code: "completion",
      eyebrow: "Primary diagnosis",
      title: "The text was not completed",
      summary: `You completed ${Math.round(completion)}% of the required text. This session cannot pass until the full target is typed.`,
      action: "Restart the same text and prioritise steady completion over speed.",
    };
  }

  if (resultContext?.purpose === "spaced-review") {
    const transfer = resultContext.reviewStage === "fresh-transfer";
    return {
      tone: "indigo",
      code: transfer ? "spaced-review-transfer" : "spaced-review-recall",
      eyebrow: transfer ? "Fresh transfer captured" : "Cold recall captured",
      title: transfer ? "The retention check has both stages" : "The first retention stage is complete",
      summary: transfer
        ? `Fresh material was typed at ${Math.round(accuracy)}% accuracy. This stage checks the learned movement outside the first recall pattern.`
        : `The movement was recalled at ${Math.round(accuracy)}% accuracy before any lesson replay or reteaching.`,
      action: transfer
        ? "Finish the review practice. Scheduling and pass/fail decisions are intentionally handled in the next review phase."
        : "Continue to fresh transfer so the same movement is checked in new curriculum-safe material.",
    };
  }

  if (accuracy < passAccuracy) {
    const gap = rounded(passAccuracy - accuracy);
    return {
      tone: "amber",
      code: "accuracy",
      eyebrow: "Primary diagnosis",
      title: "Accuracy is the main limiter",
      summary: `Your keystroke accuracy was ${Math.round(accuracy)}%, about ${gap}% below the ${passAccuracy}% target.`,
      action: mistakeWords.length || difficultKeys.length || difficultBigrams.length
        ? "Use the mistake-recovery session, then repeat this setup."
        : "Reduce pace slightly and repeat the same text once.",
    };
  }

  if (resultContext?.purpose === "guided" && !passed) {
    return {
      tone: "amber",
      code: resultContext.guidedStage === "transfer" ? "transfer-control" : "focus-control",
      eyebrow: resultContext.guidedStage === "transfer" ? "Transfer check" : "Lesson control",
      title: resultContext.guidedStage === "transfer"
        ? "The fresh transfer check needs another controlled attempt"
        : "The lesson keys need slightly better control",
      summary: "Overall accuracy reached the headline target, but the complete guided mastery rule was not met.",
      action: resultContext.requiresFreshRetry
        ? "Try a fresh target at the same difficulty; the next attempt should not rely on memorising this text."
        : "Slow down slightly and keep the lesson keys within the required error limit.",
    };
  }

  if (consistency < 45 && asNumber(result.durationSeconds) >= 45) {
    return {
      tone: "amber",
      code: "consistency",
      eyebrow: "Primary diagnosis",
      title: "Your pace varied too much",
      summary: `Consistency was ${Math.round(consistency)}%. Fast bursts followed by slow recovery make the result harder to sustain.`,
      action: "Use a two- or three-minute session and hold one comfortable rhythm from the first line.",
    };
  }

  if (correctionRate >= 12 && asNumber(result.errors) >= 4) {
    return {
      tone: "amber",
      code: "corrections",
      eyebrow: "Primary diagnosis",
      title: "Too much rhythm was spent correcting",
      summary: `${Math.round(correctionRate)}% of the session involved corrections. The final text may be clean, but the input flow was inefficient.`,
      action: "Practise the exact error words and difficult key pairs before repeating the full text.",
    };
  }

  if (resultContext?.purpose === "recovery" && passed) {
    return {
      tone: "emerald",
      code: "recovery-pass",
      eyebrow: "Recovery result",
      title: "The targeted mistakes were handled successfully",
      summary: `You completed the focused recovery at ${Math.round(accuracy)}% accuracy and ${Math.round(asNumber(result.netWpm))} net WPM.`,
      action: "Return to the original session type and check whether the improvement transfers.",
    };
  }

  if (passed) {
    return {
      tone: "emerald",
      code: "passed",
      eyebrow: "Primary diagnosis",
      title: "The target was reached with stable control",
      summary: `You sustained ${Math.round(asNumber(result.netWpm))} net WPM with ${Math.round(accuracy)}% keystroke accuracy.`,
      action: difficultKeys.length || difficultBigrams.length
        ? "Continue, but use the suggested recovery drill before raising difficulty."
        : "Repeat with fresh text or increase only one difficulty setting.",
    };
  }

  return {
    tone: "amber",
    code: "repeat",
    eyebrow: "Primary diagnosis",
    title: "Repeat once with more control",
    summary: `The attempt was valid, but it did not meet the full session target.`,
    action: "Use the same text once more so the next result is directly comparable.",
  };
}

function resultForExercise(source = {}, id) {
  return source?.[id] ?? null;
}

export function getLessonMasteryBlockers(mastery = {}, lesson, { review = false } = {}) {
  if (!lesson) return [];
  const requiredIds = lesson.exercises?.map((exercise) => exercise.id) ?? [];
  const results = review ? mastery.reviewExerciseResults ?? {} : mastery.exerciseResults ?? {};
  const passedCount = requiredIds.filter((id) => resultForExercise(results, id)?.passed).length;
  const requiredAccuracy = asNumber(lesson.passAccuracy, 94);
  const recentAccuracy = asNumber(mastery.averageAccuracy);
  const consistency = asNumber(mastery.averageConsistency);
  const focusErrorRate = asNumber(mastery.focusErrorRate, 100);
  const allowedFocusErrorRate = Math.max(10, 100 - requiredAccuracy + 5);
  const successfulAttempts = asNumber(mastery.successfulAttempts);
  const requiredAttempts = Math.max(2, requiredIds.length);
  const masteryScore = asNumber(mastery.masteryScore);

  const items = [
    {
      id: "exercises",
      label: review ? "Review exercises" : "Guided exercises",
      current: passedCount,
      target: requiredIds.length,
      unit: "",
      passed: requiredIds.length > 0 && passedCount >= requiredIds.length,
      detail: passedCount >= requiredIds.length
        ? "Every required exercise has passed."
        : `${requiredIds.length - passedCount} exercise${requiredIds.length - passedCount === 1 ? "" : "s"} still need${requiredIds.length - passedCount === 1 ? "s" : ""} a passing result.`,
    },
  ];

  if (!review) {
    items.push(
      {
        id: "attempts",
        label: "Accurate attempts",
        current: successfulAttempts,
        target: requiredAttempts,
        unit: "",
        passed: successfulAttempts >= requiredAttempts,
        detail: successfulAttempts >= requiredAttempts
          ? "The lesson has enough repeated evidence."
          : `${requiredAttempts - successfulAttempts} more accurate attempt${requiredAttempts - successfulAttempts === 1 ? "" : "s"} required.`,
      },
      {
        id: "accuracy",
        label: "Average accuracy",
        current: rounded(recentAccuracy),
        target: requiredAccuracy,
        unit: "%",
        passed: recentAccuracy >= requiredAccuracy,
        detail: recentAccuracy >= requiredAccuracy
          ? "Accuracy meets the lesson target."
          : `Raise the recent average by ${rounded(requiredAccuracy - recentAccuracy)}%.`,
      },
      {
        id: "consistency",
        label: "Consistency",
        current: Math.round(consistency),
        target: 40,
        unit: "%",
        passed: consistency >= 40,
        detail: consistency >= 40
          ? "The recent pace is stable enough."
          : "Avoid fast bursts; keep a steadier rhythm through the full exercise.",
      },
      {
        id: "focus",
        label: "Focus-key error rate",
        current: rounded(focusErrorRate),
        target: allowedFocusErrorRate,
        unit: "% max",
        passed: focusErrorRate <= allowedFocusErrorRate,
        lowerIsBetter: true,
        detail: focusErrorRate <= allowedFocusErrorRate
          ? "The lesson keys are under control."
          : `Reduce focus-key errors by ${rounded(focusErrorRate - allowedFocusErrorRate)}%.`,
      },
      {
        id: "score",
        label: "Mastery score",
        current: Math.round(masteryScore),
        target: 72,
        unit: "%",
        passed: masteryScore >= 72,
        detail: masteryScore >= 72
          ? "The combined mastery score is high enough."
          : `Gain ${Math.max(0, Math.round(72 - masteryScore))} more mastery points through accurate guided practice.`,
      },
    );
  }

  return items;
}

export function summariseMasteryBlockers(items = []) {
  const remaining = items.filter((item) => !item.passed);
  return {
    complete: items.length > 0 && remaining.length === 0,
    remaining,
    next: remaining[0] ?? null,
  };
}
