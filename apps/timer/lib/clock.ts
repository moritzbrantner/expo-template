export type TimerState = {
  durationMs: number;
  remainingMs: number;
  startedAtMs: number | null;
};

export type StopwatchState = {
  elapsedMs: number;
  startedAtMs: number | null;
};

export type ClockState = {
  timer: TimerState;
  stopwatch: StopwatchState;
};

export function createTimer(durationMs: number): TimerState {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('Timer duration must be positive.');
  }
  return { durationMs, remainingMs: durationMs, startedAtMs: null };
}

export function timerRemainingMs(timer: TimerState, nowMs = Date.now()): number {
  if (timer.startedAtMs === null) return Math.max(0, timer.remainingMs);
  return Math.max(0, timer.remainingMs - Math.max(0, nowMs - timer.startedAtMs));
}

export function startTimer(timer: TimerState, nowMs = Date.now()): TimerState {
  if (timer.startedAtMs !== null || timerRemainingMs(timer, nowMs) <= 0) return timer;
  return { ...timer, startedAtMs: nowMs };
}

export function pauseTimer(timer: TimerState, nowMs = Date.now()): TimerState {
  if (timer.startedAtMs === null) return timer;
  return { ...timer, remainingMs: timerRemainingMs(timer, nowMs), startedAtMs: null };
}

export function resetTimer(timer: TimerState): TimerState {
  return { ...timer, remainingMs: timer.durationMs, startedAtMs: null };
}

export function createStopwatch(): StopwatchState {
  return { elapsedMs: 0, startedAtMs: null };
}

export function stopwatchElapsedMs(stopwatch: StopwatchState, nowMs = Date.now()): number {
  if (stopwatch.startedAtMs === null) return Math.max(0, stopwatch.elapsedMs);
  return Math.max(0, stopwatch.elapsedMs + Math.max(0, nowMs - stopwatch.startedAtMs));
}

export function startStopwatch(stopwatch: StopwatchState, nowMs = Date.now()): StopwatchState {
  if (stopwatch.startedAtMs !== null) return stopwatch;
  return { ...stopwatch, startedAtMs: nowMs };
}

export function pauseStopwatch(stopwatch: StopwatchState, nowMs = Date.now()): StopwatchState {
  if (stopwatch.startedAtMs === null) return stopwatch;
  return { elapsedMs: stopwatchElapsedMs(stopwatch, nowMs), startedAtMs: null };
}

export function resetStopwatch(): StopwatchState {
  return createStopwatch();
}

function isTimerState(value: unknown): value is TimerState {
  if (!value || typeof value !== 'object') return false;
  const timer = value as Partial<TimerState>;
  return (
    typeof timer.durationMs === 'number' &&
    Number.isFinite(timer.durationMs) &&
    timer.durationMs > 0 &&
    typeof timer.remainingMs === 'number' &&
    Number.isFinite(timer.remainingMs) &&
    timer.remainingMs >= 0 &&
    (timer.startedAtMs === null ||
      (typeof timer.startedAtMs === 'number' && Number.isFinite(timer.startedAtMs)))
  );
}

function isStopwatchState(value: unknown): value is StopwatchState {
  if (!value || typeof value !== 'object') return false;
  const stopwatch = value as Partial<StopwatchState>;
  return (
    typeof stopwatch.elapsedMs === 'number' &&
    Number.isFinite(stopwatch.elapsedMs) &&
    stopwatch.elapsedMs >= 0 &&
    (stopwatch.startedAtMs === null ||
      (typeof stopwatch.startedAtMs === 'number' && Number.isFinite(stopwatch.startedAtMs)))
  );
}

export function deserializeClockState(value: string | null, defaultDurationMs: number): ClockState {
  const fallback = { timer: createTimer(defaultDurationMs), stopwatch: createStopwatch() };
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as { timer?: unknown; stopwatch?: unknown };
    if (!isTimerState(parsed.timer) || !isStopwatchState(parsed.stopwatch)) return fallback;
    return { timer: parsed.timer, stopwatch: parsed.stopwatch };
  } catch {
    return fallback;
  }
}
