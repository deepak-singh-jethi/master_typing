import { useCallback, useEffect, useRef, useState } from "react";
import { applyInputChange, buildSessionResult, createTypingTelemetry, getTypingMetrics, registerPause } from "@/lib/typingEngine";
import { clearRecoverySnapshot, createRecoverySnapshot, loadRecoverySnapshot, saveRecoverySnapshot } from "@/lib/sessionRecovery";

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function useTypingSession({ target, durationSeconds = null, backspaceMode = "allowed", autoPause = true, benchmarkPolicy = null, recoveryIdentity = null, onComplete }) {
  const initialRecoveryRef = useRef(undefined);
  if (initialRecoveryRef.current === undefined) initialRecoveryRef.current = recoveryIdentity ? loadRecoverySnapshot(recoveryIdentity) : null;
  const initialRecovery = initialRecoveryRef.current;
  const initialTelemetry = initialRecovery?.telemetry ? { ...createTypingTelemetry(target), ...initialRecovery.telemetry, target } : createTypingTelemetry(target);
  const initialElapsed = Math.max(0, Number(initialRecovery?.elapsedMs) || 0);
  const initialStatus = initialRecovery ? "paused" : "idle";
  const initialNow = nowMs();

  const [typed, setTyped] = useState(initialTelemetry.typed || "");
  const [status, setStatus] = useState(initialStatus);
  const [elapsedMs, setElapsedMs] = useState(initialElapsed);
  const [result, setResult] = useState(null);
  const [recoveredAt, setRecoveredAt] = useState(initialRecovery?.savedAt || null);

  const telemetryRef = useRef(initialTelemetry);
  const statusRef = useRef(initialStatus);
  const startedAtRef = useRef(initialRecovery ? initialNow - initialElapsed : null);
  const pausedAtRef = useRef(initialRecovery ? initialNow : null);
  const pausedTotalRef = useRef(0);
  const paceSamplesRef = useRef(Array.isArray(initialRecovery?.paceSamples) ? initialRecovery.paceSamples : []);
  const lastSampleSecondRef = useRef(Math.floor(initialElapsed / 1000));
  const onCompleteRef = useRef(onComplete);
  const benchmarkPolicyRef = useRef(benchmarkPolicy);
  const targetRef = useRef(target);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { benchmarkPolicyRef.current = benchmarkPolicy; }, [benchmarkPolicy]);

  const getActiveElapsed = useCallback((now = nowMs()) => {
    if (startedAtRef.current === null) return 0;
    const currentPause = statusRef.current === "paused" && pausedAtRef.current !== null ? now - pausedAtRef.current : 0;
    return Math.max(0, now - startedAtRef.current - pausedTotalRef.current - currentPause);
  }, []);

  const persistRecovery = useCallback(() => {
    if (!recoveryIdentity || statusRef.current === "completed" || !telemetryRef.current.typed) return false;
    return saveRecoverySnapshot(recoveryIdentity, createRecoverySnapshot({ identity: recoveryIdentity, telemetry: telemetryRef.current, elapsedMs: getActiveElapsed(), paceSamples: paceSamplesRef.current, status: statusRef.current }));
  }, [getActiveElapsed, recoveryIdentity]);

  const finish = useCallback((reason = "complete") => {
    if (statusRef.current === "completed") return null;
    const activeElapsed = durationSeconds ? Math.min(getActiveElapsed(), durationSeconds * 1000) : getActiveElapsed();
    const finalResult = buildSessionResult({ telemetry: telemetryRef.current, elapsedMs: Math.max(activeElapsed, 1), paceSamples: paceSamplesRef.current, reason, benchmarkPolicy: benchmarkPolicyRef.current });
    statusRef.current = "completed";
    setStatus("completed");
    setElapsedMs(activeElapsed);
    setResult(finalResult);
    setRecoveredAt(null);
    if (recoveryIdentity) clearRecoverySnapshot(recoveryIdentity);
    onCompleteRef.current?.(finalResult);
    return finalResult;
  }, [durationSeconds, getActiveElapsed, recoveryIdentity]);

  const pause = useCallback((reason = "manual") => {
    if (statusRef.current !== "running") return false;
    pausedAtRef.current = nowMs();
    registerPause(telemetryRef.current, reason);
    statusRef.current = "paused";
    setStatus("paused");
    persistRecovery();
    return true;
  }, [persistRecovery]);

  const resume = useCallback(() => {
    if (statusRef.current !== "paused") return false;
    if (pausedAtRef.current !== null) pausedTotalRef.current += nowMs() - pausedAtRef.current;
    pausedAtRef.current = null;
    statusRef.current = "running";
    setStatus("running");
    setRecoveredAt(null);
    return true;
  }, []);

  const togglePause = useCallback(() => {
    if (statusRef.current === "running") pause("manual");
    else if (statusRef.current === "paused") resume();
  }, [pause, resume]);

  useEffect(() => {
    if (status !== "running") return undefined;
    const intervalId = window.setInterval(() => {
      const elapsed = getActiveElapsed();
      setElapsedMs(elapsed);
      const elapsedSecond = Math.floor(elapsed / 1000);
      if (elapsedSecond > 0 && elapsedSecond > lastSampleSecondRef.current) {
        lastSampleSecondRef.current = elapsedSecond;
        const currentMetrics = getTypingMetrics(telemetryRef.current, elapsed);
        paceSamplesRef.current.push(Math.round(currentMetrics.netWpm * 10) / 10);
      }
      if (durationSeconds && elapsed >= durationSeconds * 1000) finish("time");
    }, 100);
    return () => window.clearInterval(intervalId);
  }, [durationSeconds, finish, getActiveElapsed, status]);

  useEffect(() => {
    if (!recoveryIdentity || status === "completed" || !typed) return undefined;
    const timeout = window.setTimeout(persistRecovery, 450);
    const interval = status === "running" ? window.setInterval(persistRecovery, 2000) : null;
    return () => { window.clearTimeout(timeout); if (interval) window.clearInterval(interval); };
  }, [persistRecovery, recoveryIdentity, status, typed]);

  useEffect(() => {
    if (!recoveryIdentity) return undefined;
    const handlePageExit = () => persistRecovery();
    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    return () => {
      persistRecovery();
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
    };
  }, [persistRecovery, recoveryIdentity]);

  useEffect(() => {
    if (!autoPause) return undefined;
    const handleVisibility = () => { if (document.hidden) pause("visibility"); };
    const handleWindowBlur = () => pause("focus-loss");
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleWindowBlur);
    return () => { document.removeEventListener("visibilitychange", handleVisibility); window.removeEventListener("blur", handleWindowBlur); };
  }, [autoPause, pause]);

  const startIfNeeded = useCallback(() => {
    if (statusRef.current !== "idle") return;
    startedAtRef.current = nowMs();
    statusRef.current = "running";
    setStatus("running");
  }, []);

  const handleInput = useCallback((nextValue, meta = {}) => {
    if (statusRef.current === "paused" || statusRef.current === "completed") return telemetryRef.current.typed;
    const current = telemetryRef.current.typed;
    if (String(nextValue ?? "") === current) return current;
    startIfNeeded();
    const change = applyInputChange(telemetryRef.current, nextValue, getActiveElapsed(), { backspaceMode, inputType: meta.inputType, isCompositionCommit: Boolean(meta.isCompositionCommit) });
    const accepted = change.acceptedValue;
    setTyped(accepted);
    if (accepted.length >= target.length) window.setTimeout(() => finish(durationSeconds ? "text-ended" : "complete"), 0);
    return accepted;
  }, [backspaceMode, durationSeconds, finish, getActiveElapsed, startIfNeeded, target.length]);

  const reset = useCallback(() => {
    telemetryRef.current = createTypingTelemetry(target);
    statusRef.current = "idle";
    startedAtRef.current = null;
    pausedAtRef.current = null;
    pausedTotalRef.current = 0;
    paceSamplesRef.current = [];
    lastSampleSecondRef.current = 0;
    setTyped(""); setStatus("idle"); setElapsedMs(0); setResult(null); setRecoveredAt(null);
    if (recoveryIdentity) clearRecoverySnapshot(recoveryIdentity);
  }, [recoveryIdentity, target]);

  useEffect(() => {
    if (targetRef.current === target) return;
    targetRef.current = target;
    reset();
  }, [reset, target]);

  const metrics = getTypingMetrics(telemetryRef.current, Math.max(elapsedMs, 1));
  const remainingMs = durationSeconds ? Math.max(0, durationSeconds * 1000 - elapsedMs) : null;

  return { typed, status, elapsedMs, remainingMs, result, metrics, recoveredAt, expectedCharacter: target[typed.length] ?? "", handleInput, pause, resume, togglePause, reset, finish, persistRecovery };
}
