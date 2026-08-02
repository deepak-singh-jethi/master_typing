import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/common/Button";
import { TypingWorkspace } from "@/components/typing/TypingWorkspace";
import { useApp } from "@/hooks/useApp";
import { generatePracticeText } from "@/data/contentBank";
import { testPresets } from "@/data/practicePresets";
import { getBenchmarkPolicy } from "@/lib/sessionRules";
import { buildRecoveryConfig } from "@/lib/practiceRecipes";
import { buildSessionComparison } from "@/lib/resultCoaching";
import { buildProficiencyAttemptFields, classifyCourseProficiency } from "@/lib/proficiency";

export function TestSessionPage() {
  const { testId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, recordSession } = useApp();
  const test = testPresets.find((item) => item.id === testId);
  const [seed, setSeed] = useState(Date.now());
  const [lastResult, setLastResult] = useState(null);
  const [comparison, setComparison] = useState(null);
  const remediation = location.state?.remediation ?? null;

  const config = useMemo(() => test ? {
    contentType: test.contentType,
    category: "general",
    goalType: "time",
    durationSeconds: test.durationSeconds,
    difficulty: test.difficulty,
    punctuation: Boolean(test.punctuation),
    capitals: Boolean(test.capitals),
    seed,
  } : null, [seed, test]);

  const target = useMemo(() => config ? generatePracticeText(config) : "", [config]);
  const benchmarkPolicy = useMemo(() => test ? getBenchmarkPolicy(test) : null, [test]);
  const assessmentResult = useMemo(
    () => lastResult && test?.assessment ? classifyCourseProficiency(lastResult, test.assessment) : null,
    [lastResult, test],
  );

  const handleComplete = useCallback((result) => {
    if (!test) return;
    const classification = classifyCourseProficiency(result, test.assessment);
    setLastResult(result);
    setComparison(buildSessionComparison(result, data.attempts, { type: "test", testId: test.id, modeId: test.id, durationSeconds: test.durationSeconds }));
    recordSession({
      ...result,
      type: "test",
      modeId: test.id,
      testId: test.id,
      testTitle: test.title,
      sessionPassed: result.benchmarkValid === true && result.validSession !== false,
      remediationVersion: remediation?.version,
      remediationChainId: remediation?.chainId,
      remediationStage: remediation?.stage,
      remediationSourceType: remediation?.sourceType,
      remediationSourceId: remediation?.sourceId,
      remediationFreshText: remediation?.stage === "reassessment" ? true : undefined,
      ...buildProficiencyAttemptFields(classification),
    });
  }, [data.attempts, recordSession, remediation, test]);

  if (!test) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
        <p>This test does not exist.</p>
        <Button as={Link} to="/tests" variant="secondary" className="mt-4">Return to tests</Button>
      </div>
    );
  }

  const freshText = () => {
    setLastResult(null);
    setComparison(null);
    setSeed(Date.now());
  };

  const practiseMistakes = () => {
    if (!lastResult) return;
    navigate("/practice/session", {
      state: {
        config: {
          ...buildRecoveryConfig(lastResult, { category: "general" }, {
            sourceType: "test",
            sourceId: test.id,
            returnTarget: { kind: "test", to: `/tests/${test.id}`, label: test.title },
          }),
          seed: Date.now(),
        },
      },
    });
  };

  return (
    <TypingWorkspace
      key={`${test.id}-${seed}`}
      sessionLabel={test.assessment?.mode === "level" ? "Course level assessment" : test.assessment?.mode === "estimate" ? "Progress check" : "Typing check"}
      title={test.title}
      description={`${test.description} The test runs for ${test.durationSeconds < 60 ? `${test.durationSeconds} seconds` : `${test.durationSeconds / 60} minute${test.durationSeconds > 60 ? "s" : ""}`}. Keep your focus on the text rather than the live score.`}
      target={target}
      durationSeconds={test.durationSeconds}
      passAccuracy={0}
      countdownSeconds={3}
      allowContinueWhenInvalid
      benchmarkPolicy={benchmarkPolicy}
      requireComplete={false}
      showKeyboard={false}
      soundEnabled={data.settings.soundEnabled}
      showLiveWpm={data.settings.showLiveWpm}
      showLiveAccuracy={data.settings.showLiveAccuracy}
      autoPause={data.settings.autoPause}
      backspaceMode={data.settings.backspaceMode}
      textSize={data.settings.textSize}
      caretStyle={data.settings.caretStyle}
      onComplete={handleComplete}
      onContinue={() => navigate("/tests")}
      continueLabel="Back to tests"
      onNewText={freshText}
      newTextLabel="Fresh test text"
      comparison={comparison}
      assessmentResult={assessmentResult}
      onPracticeMistakes={practiseMistakes}
      exitTo="/tests"
      exitLabel="Exit test"
    />
  );
}
