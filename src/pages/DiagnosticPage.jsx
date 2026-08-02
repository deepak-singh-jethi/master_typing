import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TypingWorkspace } from "@/components/typing/TypingWorkspace";
import { useApp } from "@/hooks/useApp";
import { generatePracticeText } from "@/data/contentBank";
import { getDiagnosticPolicy } from "@/lib/sessionRules";
import { buildRecoveryConfig } from "@/lib/practiceRecipes";
import { buildSessionComparison } from "@/lib/resultCoaching";

export function DiagnosticPage() {
  const navigate = useNavigate();
  const { data, recordSession, saveDiagnostic } = useApp();
  const [seed, setSeed] = useState(Date.now());
  const [lastResult, setLastResult] = useState(null);
  const [comparison, setComparison] = useState(null);

  const target = useMemo(() => generatePracticeText({
    contentType: "sentences",
    category: "general",
    goalType: "time",
    durationSeconds: 120,
    punctuation: true,
    capitals: true,
    seed,
  }), [seed]);

  const handleComplete = useCallback((result) => {
    setLastResult(result);
    setComparison(buildSessionComparison(result, data.attempts, { type: "diagnostic", modeId: "diagnostic-120", durationSeconds: 120 }));
    saveDiagnostic({
      ...result,
      netWpm: result.netWpm,
      accuracy: result.accuracy,
      consistency: result.consistency,
    });
    recordSession({
      ...result,
      type: "diagnostic",
      modeId: "diagnostic-120",
      testTitle: "2-minute diagnostic",
      sessionPassed: result.benchmarkValid === true && result.validSession !== false,
    });
  }, [data.attempts, recordSession, saveDiagnostic]);

  const freshText = () => {
    setLastResult(null);
    setComparison(null);
    setSeed(Date.now());
  };

  const practiseMistakes = () => {
    if (!lastResult) return;
    navigate("/practice/session", { state: { config: { ...buildRecoveryConfig(lastResult, { category: "general" }), seed: Date.now() } } });
  };

  return (
    <TypingWorkspace
      key={seed}
      sessionLabel="Starting benchmark"
      title="2-minute typing diagnostic"
      description="Type naturally. The result checks speed, accuracy, and consistency. Beginners and hunt-and-peck typists still begin with technique; verified touch typists may receive placement credit for earlier lessons."
      target={target}
      durationSeconds={120}
      passAccuracy={0}
      countdownSeconds={3}
      allowContinueWhenInvalid
      benchmarkPolicy={getDiagnosticPolicy(120)}
      requireComplete={false}
      showKeyboard={false}
      soundEnabled={data.settings.soundEnabled}
      showLiveWpm={false}
      showLiveAccuracy={true}
      autoPause={data.settings.autoPause}
      backspaceMode={data.settings.backspaceMode}
      textSize={data.settings.textSize}
      caretStyle={data.settings.caretStyle}
      onComplete={handleComplete}
      onContinue={() => navigate("/")}
      continueLabel="See my learning plan"
      onNewText={freshText}
      newTextLabel="Fresh diagnostic text"
      comparison={comparison}
      onPracticeMistakes={practiseMistakes}
      exitTo="/"
      exitLabel="Exit diagnostic"
    />
  );
}
