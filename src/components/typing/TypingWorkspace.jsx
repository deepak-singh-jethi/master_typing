import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Keyboard,
  Lightbulb,
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
  layout = "standard",
  lessonTip = "",
  focusKeys = [],
  recoverySessionId = null,
}) {
  const { workspaceId = "guest" } = useApp();
  const inputRef = useRef(null);
  const workspaceRef = useRef(null);
  const composingRef = useRef(false);
  const [hasFocus, setHasFocus] = useState(false);
  const isLessonFocus = layout === "lesson-focus";
  const [keyboardVisible, setKeyboardVisible] = useState(() => isLessonFocus);
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
    sessionId: recoverySessionId || `${sessionLabel}:${title}`,
  }), [backspaceMode, durationSeconds, recoverySessionId, sessionLabel, target, title, workspaceId]);

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

  const statusLabel = session.status === "running"
    ? "Keep typing…"
    : session.status === "paused"
      ? "Paused"
      : sessionReady
        ? "Start typing…"
        : "Get ready…";

  const typingInput = (
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
  );

  const typingContent = !sessionReady ? (
    <div className={cn("grid place-items-center text-center", isLessonFocus ? "min-h-[21rem] sm:min-h-[23rem]" : "min-h-[13rem] sm:min-h-[15rem]")}>
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/15">
          {countdownActive ? <span className="text-2xl font-bold">{countdownRemaining || "Go"}</span> : <TimerReset className="size-6" />}
        </span>
        <p className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">{countdownActive ? "Get ready" : "Ready when you are"}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {countdownActive ? "Settle your hands and look at the first word." : `A ${countdownSeconds}-second countdown starts before the timer.`}
        </p>
        {!countdownActive && (
          <Button variant="brand" className="mt-5" onClick={beginCountdown}>
            <Play className="size-4" />Start countdown
          </Button>
        )}
      </div>
    </div>
  ) : session.status === "paused" ? (
    <div className={cn("grid place-items-center text-center", isLessonFocus ? "min-h-[21rem] sm:min-h-[23rem]" : "min-h-[13rem] sm:min-h-[15rem]")}>
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Pause className="size-5" /></span>
        <p className="mt-4 font-semibold text-slate-950 dark:text-white">Session paused</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your position and timer are safe. Resume when ready.</p>
        <Button variant="brand" className="mt-4" onClick={() => { session.resume(); window.setTimeout(focusInput, 30); }}>
          <Play className="size-4" aria-hidden="true" />Resume typing
        </Button>
      </div>
    </div>
  ) : (
    <TypingText target={target} typed={session.typed} textSize={textSize} caretStyle={caretStyle} variant={isLessonFocus ? "lesson-focus" : "standard"} />
  );

  if (isLessonFocus) {
    return (
      <div ref={workspaceRef} className="space-y-4">
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusAnnouncement}</p>

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
          <section aria-labelledby="session-title" className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-[0_22px_60px_-42px_rgba(15,23,42,0.5)] dark:border-slate-800 dark:bg-[#07111f]">
            <h2 id="session-title" className="sr-only">{title}</h2>
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800/90">
              <div className="flex flex-wrap items-center gap-x-9 gap-y-3">
                {showLiveAccuracy && <FocusMetric tone="emerald" label="Accuracy" value={`${Math.round(session.metrics.keystrokeAccuracy)}%`} />}
                {showLiveWpm && <FocusMetric tone="sky" label="WPM" value={Math.round(session.metrics.netWpm)} />}
                <FocusMetric tone="amber" label={durationSeconds ? "Time left" : "Time"} value={formatClock(displayTime)} />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-w-[8rem] border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70"
                  disabled={session.status !== "running" && session.status !== "paused"}
                  onClick={session.togglePause}
                >
                  {session.status === "paused" ? <Play className="size-4" /> : <Pause className="size-4" />}
                  {session.status === "paused" ? "Resume" : "Pause"}
                </Button>
                <Button variant="secondary" size="sm" className="min-w-[8rem] border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70" onClick={restart}>
                  <RefreshCcw className="size-4" />Restart
                </Button>
              </div>
            </div>

            <div className="px-3 pt-3 sm:px-4 sm:pt-4">
              <div
                role="group"
                aria-label="Typing practice area"
                tabIndex={-1}
                onClick={sessionReady ? focusInput : beginCountdown}
                className={cn(
                  "relative min-h-[22rem] cursor-text overflow-hidden rounded-[1.35rem] border bg-slate-50 px-5 pb-11 pt-14 outline-none transition sm:min-h-[24rem] sm:px-8 sm:pt-16 dark:bg-[#060c1a]",
                  session.status === "paused"
                    ? "border-amber-300 dark:border-amber-500/40"
                    : hasFocus
                      ? "border-violet-500 shadow-[0_0_0_1px_rgba(139,92,246,0.42),0_0_26px_rgba(124,58,237,0.20)]"
                      : "border-violet-400/70 dark:border-violet-500/70 dark:shadow-[0_0_24px_rgba(124,58,237,0.12)]",
                )}
              >
                {typingInput}
                <p id="typing-help" className="sr-only">Type the displayed passage. Timing begins with your first accepted character. Escape pauses the session.</p>

                <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
                  <span className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur",
                    session.status === "running"
                      ? "border-violet-400/20 bg-violet-600/[0.12] text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"
                      : session.status === "paused"
                        ? "border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "border-slate-200 bg-white/80 text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300",
                  )}>
                    <span className={cn("size-2 rounded-full", session.status === "running" ? "bg-violet-500" : session.status === "paused" ? "bg-amber-500" : "bg-slate-400")} />
                    {statusLabel}
                  </span>
                </div>

                {typingContent}

                {sessionReady && !hasFocus && session.status === "running" && (
                  <button
                    type="button"
                    onClick={focusInput}
                    className="absolute inset-x-6 bottom-12 rounded-xl border border-violet-300/30 bg-violet-600/10 px-4 py-3 text-sm font-semibold text-violet-700 shadow-sm backdrop-blur dark:text-violet-200"
                  >
                    Click here to continue typing
                  </button>
                )}

                <div className="absolute inset-x-7 bottom-4">
                  <div className="h-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-[width] duration-200" style={{ width: `${Math.min(100, Math.max(0, session.metrics.completion))}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums text-violet-600 dark:text-violet-400">{Math.round(session.metrics.completion)}% complete</span>
                    <span>{session.metrics.errors ?? 0} errors</span>
                  </div>
                </div>
              </div>
            </div>

            {showKeyboard && sessionReady && session.status !== "paused" && (
              <div className="px-4 pb-3 pt-3 sm:px-7">
                {keyboardVisible && (
                  <OnScreenKeyboard
                    expectedCharacter={session.expectedCharacter}
                    focusKeys={focusKeys}
                    variant="lesson-focus"
                  />
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-7 dark:border-slate-800/90">
              <div className="flex min-w-0 items-center gap-3 text-slate-600 dark:text-slate-300">
                <Lightbulb className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
                <span className="font-semibold text-slate-800 dark:text-white">Tip</span>
                <span className="truncate text-xs sm:text-sm">{lessonTip || description || "Keep your hands relaxed and return to the home row."}</span>
              </div>
              {showKeyboard && (
                <button
                  type="button"
                  onClick={() => setKeyboardVisible((current) => !current)}
                  aria-expanded={keyboardVisible}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-500/50 dark:hover:text-violet-300"
                >
                  <Keyboard className="size-4" />Keyboard guide
                </button>
              )}
            </div>
          </section>
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

  return (
    <div ref={workspaceRef} className="space-y-4 sm:space-y-5">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusAnnouncement}</p>
      {showSessionNav && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={exitTo} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="size-4" aria-hidden="true" />{exitLabel}
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400"><span>{backspaceLabel}</span><span>·</span><span>Esc to pause</span></div>
        </div>
      )}

      {session.recoveredAt && !session.result && (
        <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-200">
          <div><p className="font-semibold">Recovered unfinished session</p><p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-300">Your typed text and timing were restored in a paused state.</p></div>
          <Button size="sm" onClick={session.resume}><Play className="size-4" aria-hidden="true" />Resume session</Button>
        </div>
      )}

      {!session.result && (
        <section aria-labelledby="session-title" className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_45px_-36px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900">
          {sessionControls && <div className="border-b border-slate-200 bg-slate-50/65 px-4 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">{sessionControls}</div>}
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6 dark:border-slate-800">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">{sessionLabel}</p>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", session.status === "running" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : session.status === "paused" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300")}>{session.status === "running" ? "Typing" : session.status === "paused" ? "Paused" : "Ready"}</span>
                </div>
                <h1 id="session-title" className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950 dark:text-white">{title}</h1>
                {description && <p className="mt-2 max-w-[46rem] text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>}
              </div>
              <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[22rem]">
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {showLiveWpm && <LiveValue label="WPM" value={Math.round(session.metrics.netWpm)} />}
                  {showLiveAccuracy && <LiveValue label="Accuracy" value={`${Math.round(session.metrics.keystrokeAccuracy)}%`} />}
                  <LiveValue label={durationSeconds ? "Time left" : "Time"} value={formatClock(displayTime)} />
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button variant="secondary" size="sm" className="min-w-[7.5rem]" disabled={session.status !== "running" && session.status !== "paused"} onClick={session.togglePause}>{session.status === "paused" ? <Play className="size-4" /> : <Pause className="size-4" />}{session.status === "paused" ? "Resume" : "Pause"}</Button>
                  <Button variant="ghost" size="sm" className="min-w-[7.5rem]" onClick={restart}><RefreshCcw className="size-4" />Restart</Button>
                </div>
              </div>
            </div>
          </div>
          <div className="p-3 sm:p-5">
            <div className="rounded-[1.55rem] border border-slate-200 bg-slate-50/70 p-2.5 sm:p-3 dark:border-slate-800 dark:bg-slate-950/35">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><span className={cn("size-2 rounded-full", session.status === "running" ? "bg-emerald-500" : hasFocus ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600")} />{session.status === "running" ? "Keep typing" : sessionReady ? "Ready for your first key" : "Get ready"}</div>
                <div className="hidden items-center gap-2 text-[10px] font-medium text-slate-400 sm:flex"><span>{backspaceLabel}</span><span aria-hidden="true">·</span><span>Esc pauses</span></div>
              </div>
              <div role="group" aria-label="Typing practice area" tabIndex={-1} onClick={sessionReady ? focusInput : beginCountdown} className={cn("relative min-h-[13rem] cursor-text rounded-[1.35rem] border bg-white p-4 outline-none transition sm:min-h-[15.5rem] sm:p-6 dark:bg-slate-950/65", session.status === "paused" ? "border-amber-300 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/[0.06]" : hasFocus ? "border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.10)] dark:border-indigo-500" : "border-slate-200 dark:border-slate-800")}>
                {typingInput}
                {typingContent}
                {sessionReady && session.status === "idle" && <div id="typing-help" className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300"><Keyboard className="size-4" />Start typing — timing begins with your first accepted character.</div>}
                {sessionReady && !hasFocus && session.status === "running" && <button type="button" onClick={focusInput} className="absolute inset-x-4 bottom-4 rounded-xl border border-indigo-200 bg-indigo-50/95 px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300">Click here to continue typing</button>}
              </div>
              <div className="px-1.5 pb-1 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400"><span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">{Math.round(session.metrics.completion)}% complete</span><span className="sm:hidden">Next: {session.expectedCharacter === " " ? "Space" : session.expectedCharacter || "—"}</span><span className="hidden sm:inline">{session.metrics.correctionActions} corrections · {session.metrics.correctedErrors} errors fixed</span></div>
                <ProgressBar value={session.metrics.completion} className="mt-2" />
              </div>
            </div>
          </div>
        </section>
      )}

      {showKeyboard && !session.result && sessionReady && session.status !== "paused" && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setKeyboardVisible((current) => !current)} aria-expanded={keyboardVisible} aria-controls="keyboard-guide"><Keyboard className="size-4" />{keyboardVisible ? "Hide keyboard guide" : "Show keyboard guide"}</Button>
          {keyboardVisible && <div id="keyboard-guide" className="mt-3"><OnScreenKeyboard expectedCharacter={session.expectedCharacter} /></div>}
        </div>
      )}

      {session.result && (
        <SessionResults result={session.result} passed={passed} passAccuracy={passAccuracy} requireComplete={requireComplete} onRetry={onResultRetry || restart} retryLabel={retryLabel} onContinue={passed ? onContinue : undefined} continueLabel={continueLabel} onNewText={onNewText} newTextLabel={newTextLabel} onPracticeMistakes={onPracticeMistakes} resultContext={resultContext} comparison={comparison} assessmentResult={assessmentResult} masteryBlockers={masteryBlockers} />
      )}
    </div>
  );
}

function FocusMetric({ tone, label, value }) {
  const stroke = tone === "emerald" ? "stroke-emerald-500" : tone === "sky" ? "stroke-sky-500" : "stroke-amber-500";
  return (
    <div className="flex min-w-[9.8rem] items-end gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-slate-950 dark:text-white">{value}</p>
      </div>
      <svg viewBox="0 0 72 30" className="mb-1 h-7 w-[4.5rem]" aria-hidden="true">
        <path d="M2 24 C8 24 8 13 14 13 S20 23 26 18 32 25 38 18 44 23 50 16 56 22 62 8 70 9" fill="none" className={cn("stroke-[1.6]", stroke)} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function LiveValue({ label, value }) {
  return (
    <div className="min-w-[6.2rem] rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-left dark:border-slate-700/80 dark:bg-slate-800/70">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
