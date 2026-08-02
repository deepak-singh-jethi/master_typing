import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Keyboard,
  Pause,
  Play,
  RefreshCcw,
  TimerReset,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { OnScreenKeyboard } from "@/components/typing/OnScreenKeyboard";
import { SessionResults } from "@/components/typing/SessionResults";
import { TypingText } from "@/components/typing/TypingText";
import { useTypingSession } from "@/hooks/useTypingSession";
import { useApp } from "@/hooks/useApp";
import { buildRecoveryIdentity } from "@/lib/sessionRecovery";
import { cn, formatClock } from "@/lib/utils";

let audioContext;
function playKeySound(correct) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ??= new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = correct ? 520 : 180;
    gain.gain.setValueAtTime(0.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.04);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.04);
  } catch {
    // Sound is optional; unsupported browsers simply stay silent.
  }
}

export function TypingWorkspace({
  title,
  description,
  target,
  durationSeconds = null,
  passAccuracy = 0,
  requireComplete = false,
  sessionLabel = "Practice session",
  exitTo = "/practice",
  exitLabel = "Exit session",
  showKeyboard = true,
  soundEnabled = false,
  showLiveWpm = true,
  showLiveAccuracy = true,
  autoPause = true,
  backspaceMode = "allowed",
  textSize = "medium",
  caretStyle = "bar",
  countdownSeconds = 0,
  benchmarkPolicy = null,
  allowContinueWhenInvalid = false,
  onComplete,
  onContinue,
  onResultRetry,
  resultPassEvaluator,
  continueLabel = "Continue",
  onNewText,
  newTextLabel = "New text",
  retryLabel = "Retry same text",
  onPracticeMistakes,
  resultContext = null,
  comparison = null,
  assessmentResult = null,
  masteryBlockers = [],
  sessionControls = null,
  showSessionNav = true,
}) {
  const { workspaceId = "guest" } = useApp();
  const inputRef = useRef(null);
  const workspaceRef = useRef(null);
  const composingRef = useRef(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownRemaining, setCountdownRemaining] = useState(countdownSeconds);
  const [sessionReady, setSessionReady] = useState(countdownSeconds <= 0);

  const handleComplete = useCallback((metrics) => {
    onComplete?.(metrics);
  }, [onComplete]);

  const recoveryIdentity = useMemo(() => buildRecoveryIdentity({
    workspaceId,
    target,
    durationSeconds,
    backspaceMode,
    sessionId: `${sessionLabel}:${title}`,
  }), [backspaceMode, durationSeconds, sessionLabel, target, title, workspaceId]);

  const session = useTypingSession({
    target,
    durationSeconds,
    backspaceMode,
    autoPause,
    benchmarkPolicy,
    recoveryIdentity,
    onComplete: handleComplete,
  });

  useEffect(() => {
    setInputValue(session.typed);
  }, [session.typed]);

  useEffect(() => {
    if (!session.recoveredAt) return;
    setSessionReady(true);
    setCountdownActive(false);
    setCountdownRemaining(0);
  }, [session.recoveredAt]);

  const focusInput = useCallback(() => {
    if (sessionReady && session.status !== "completed" && session.status !== "paused") {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [session.status, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return undefined;
    const id = window.setTimeout(focusInput, 140);
    return () => window.clearTimeout(id);
  }, [focusInput, sessionReady, target]);

  useEffect(() => {
    if (!countdownActive) return undefined;
    if (countdownRemaining <= 0) {
      setCountdownActive(false);
      setSessionReady(true);
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
      return undefined;
    }

    const timer = window.setTimeout(
      () => setCountdownRemaining((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [countdownActive, countdownRemaining]);

  const beginCountdown = useCallback(() => {
    if (countdownSeconds <= 0) {
      setSessionReady(true);
      window.setTimeout(focusInput, 20);
      return;
    }
    setCountdownRemaining(countdownSeconds);
    setCountdownActive(true);
  }, [countdownSeconds, focusInput]);

  const commitInputValue = useCallback((nextValue, meta = {}) => {
    const previous = session.typed;
    const accepted = session.handleInput(nextValue, meta);
    setInputValue(accepted);

    if (soundEnabled && accepted.length > previous.length) {
      const position = previous.length;
      playKeySound(accepted[position] === target[position]);
    }
    return accepted;
  }, [session, soundEnabled, target]);

  const handleChange = (event) => {
    const nextValue = event.target.value;
    setInputValue(nextValue);
    if (composingRef.current || event.nativeEvent?.isComposing) return;
    commitInputValue(nextValue, { inputType: event.nativeEvent?.inputType });
  };

  const restart = useCallback(() => {
    session.reset();
    setInputValue("");
    composingRef.current = false;
    if (countdownSeconds > 0) {
      setSessionReady(false);
      setCountdownActive(false);
      setCountdownRemaining(countdownSeconds);
    } else {
      setSessionReady(true);
      window.setTimeout(focusInput, 50);
    }
  }, [countdownSeconds, focusInput, session]);

  const resultIntegrityPassed = !session.result
    || allowContinueWhenInvalid
    || (session.result.validSession !== false && session.result.benchmarkValid !== false);
  const passed = Boolean(session.result)
    && resultIntegrityPassed
    && (resultPassEvaluator
      ? resultPassEvaluator(session.result)
      : session.result.accuracy >= passAccuracy
        && (!requireComplete || session.result.completion >= 99.9));

  const displayTime = durationSeconds ? session.remainingMs : session.elapsedMs;
  const backspaceLabel = backspaceMode === "disabled"
    ? "Backspace off"
    : backspaceMode === "errors-only"
      ? "Correct errors only"
      : "Backspace allowed";
  const statusAnnouncement = session.result
    ? "Session completed. Results are ready."
    : session.status === "paused"
      ? "Session paused."
      : session.recoveredAt
        ? "Unfinished session recovered in a paused state."
        : session.status === "running"
          ? "Typing session in progress."
          : "Typing session ready.";

  if (!target) {
    return (
      <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
        This session has no practice text. Return to the setup page and add or generate some text first.
      </div>
    );
  }

  return (
    <div ref={workspaceRef} className="space-y-4 sm:space-y-5">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusAnnouncement}</p>
      {showSessionNav && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={exitTo} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="size-4" aria-hidden="true" />{exitLabel}
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>{backspaceLabel}</span>
            <span>·</span>
            <span>Esc to pause</span>
          </div>
        </div>
      )}

      {session.recoveredAt && !session.result && (
        <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-200">
          <div>
            <p className="font-semibold">Recovered unfinished session</p>
            <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-300">Your typed text and timing were restored in a paused state.</p>
          </div>
          <Button size="sm" onClick={session.resume}><Play className="size-4" aria-hidden="true" />Resume session</Button>
        </div>
      )}

      {!session.result && (
        <section aria-labelledby="session-title" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {sessionControls && (
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3 sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
              {sessionControls}
            </div>
          )}
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.17em] text-indigo-600 dark:text-indigo-400">{sessionLabel}</p>
                <h1 id="session-title" className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl dark:text-white">{title}</h1>
                {description && <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {showLiveWpm && <LiveValue label="WPM" value={Math.round(session.metrics.netWpm)} />}
                {showLiveAccuracy && <LiveValue label="Accuracy" value={`${Math.round(session.metrics.keystrokeAccuracy)}%`} />}
                <LiveValue label={durationSeconds ? "Left" : "Time"} value={formatClock(displayTime)} />
                {(session.status === "running" || session.status === "paused") && (
                  <Button variant="secondary" size="sm" onClick={session.togglePause}>
                    {session.status === "paused" ? <Play className="size-4" /> : <Pause className="size-4" />}
                    {session.status === "paused" ? "Resume" : "Pause"}
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={restart}>
                  <RefreshCcw className="size-4" />Restart
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div
              role="group"
              aria-label="Typing practice area"
              tabIndex={-1}
              onClick={sessionReady ? focusInput : beginCountdown}
              className={cn(
                "relative min-h-[14rem] cursor-text rounded-3xl border p-4 outline-none transition sm:min-h-[17rem] sm:p-7",
                session.status === "paused"
                  ? "border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5"
                  : hasFocus
                    ? "border-indigo-400 bg-white ring-4 ring-indigo-500/10 dark:border-indigo-500 dark:bg-slate-950/50"
                    : "border-slate-200 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-950/50",
              )}
            >
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleChange}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={(event) => {
                  composingRef.current = false;
                  commitInputValue(event.currentTarget.value, {
                    inputType: "insertCompositionText",
                    isCompositionCommit: true,
                  });
                }}
                onFocus={() => setHasFocus(true)}
                onBlur={() => {
                  setHasFocus(false);
                  if (autoPause) {
                    window.setTimeout(() => {
                      if (!workspaceRef.current?.contains(document.activeElement)) {
                        session.pause("focus-loss");
                      }
                    }, 0);
                  }
                }}
                onPaste={(event) => event.preventDefault()}
                onDrop={(event) => event.preventDefault()}
                onSelect={(event) => {
                  const end = event.currentTarget.value.length;
                  event.currentTarget.setSelectionRange(end, end);
                }}
                onKeyDown={(event) => {
                  if (!sessionReady && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    beginCountdown();
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    session.togglePause();
                  }
                  if (event.altKey && event.key.toLowerCase() === "r") {
                    event.preventDefault();
                    restart();
                  }
                }}
                disabled={!sessionReady || session.status === "completed" || session.status === "paused"}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                aria-label={`Typing input for ${title}`}
                className="absolute left-3 top-3 h-px w-px resize-none opacity-0"
                aria-describedby="typing-help"
              />

              {!sessionReady ? (
                <div className="grid min-h-[15rem] place-items-center text-center">
                  <div>
                    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                      {countdownActive ? <span className="text-2xl font-bold">{countdownRemaining || "Go"}</span> : <TimerReset className="size-6" />}
                    </span>
                    <p className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">
                      {countdownActive ? "Get ready" : "Start when you are ready"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {countdownActive ? "Place your fingers and focus on the first word." : `A ${countdownSeconds}-second countdown will begin before the timer.`}
                    </p>
                    {!countdownActive && (
                      <Button variant="brand" className="mt-5" onClick={beginCountdown}>
                        <Play className="size-4" />Start countdown
                      </Button>
                    )}
                  </div>
                </div>
              ) : session.status === "paused" ? (
                <div className="grid min-h-[15rem] place-items-center text-center">
                  <div>
                    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      <Pause className="size-5" />
                    </span>
                    <p className="mt-4 font-semibold text-slate-950 dark:text-white">Session paused</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your timer is stopped. Resume when ready.</p>
                    <Button variant="brand" className="mt-4" onClick={() => { session.resume(); window.setTimeout(focusInput, 30); }}>
                      <Play className="size-4" aria-hidden="true" />Resume session
                    </Button>
                  </div>
                </div>
              ) : (
                <TypingText target={target} typed={session.typed} textSize={textSize} caretStyle={caretStyle} />
              )}

              {sessionReady && session.status === "idle" && (
                <div id="typing-help" className="mt-5 flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Keyboard className="size-4" />
                  Start typing. The timer begins with your first accepted character.
                </div>
              )}

              {sessionReady && !hasFocus && session.status === "running" && (
                <button
                  type="button"
                  onClick={focusInput}
                  className="absolute inset-x-5 bottom-5 rounded-2xl border border-indigo-200 bg-indigo-50/95 px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300"
                >
                  Click to continue typing
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>{Math.round(session.metrics.completion)}% complete</span>
              <span className="sm:hidden">Next: {session.expectedCharacter === " " ? "Space" : session.expectedCharacter || "—"}</span>
              <span className="hidden sm:inline">{session.metrics.correctionActions} corrections · {session.metrics.correctedErrors} errors fixed</span>
            </div>
            <ProgressBar value={session.metrics.completion} className="mt-2" />
          </div>
        </section>
      )}

      {showKeyboard && !session.result && sessionReady && session.status !== "paused" && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKeyboardVisible((current) => !current)}
            aria-expanded={keyboardVisible}
            aria-controls="keyboard-guide"
          >
            <Keyboard className="size-4" />{keyboardVisible ? "Hide keyboard guide" : "Show keyboard guide"}
          </Button>
          {keyboardVisible && <div id="keyboard-guide" className="mt-3"><OnScreenKeyboard expectedCharacter={session.expectedCharacter} /></div>}
        </div>
      )}

      {session.result && (
        <SessionResults
          result={session.result}
          passed={passed}
          passAccuracy={passAccuracy}
          requireComplete={requireComplete}
          onRetry={onResultRetry || restart}
          retryLabel={retryLabel}
          onContinue={passed ? onContinue : undefined}
          continueLabel={continueLabel}
          onNewText={onNewText}
          newTextLabel={newTextLabel}
          onPracticeMistakes={onPracticeMistakes}
          resultContext={resultContext}
          comparison={comparison}
          assessmentResult={assessmentResult}
          masteryBlockers={masteryBlockers}
        />
      )}
    </div>
  );
}

function LiveValue({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-100 px-3 py-2 text-right dark:bg-slate-800">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
