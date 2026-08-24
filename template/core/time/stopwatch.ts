export type StopwatchState = {
  status: 'idle' | 'running' | 'paused' | 'suspended';
  elapsedMs: number;
  startedAt: number | null;
  suspendedAt: {
    monotonicMs: number;
    wallMs: number;
  } | null;
};

export function createStopwatch(): StopwatchState {
  return { status: 'idle', elapsedMs: 0, startedAt: null, suspendedAt: null };
}

export function startStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.status === 'running' || state.status === 'suspended') return state;
  return { ...state, status: 'running', startedAt: now, suspendedAt: null };
}

export function pauseStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.status !== 'running' || state.startedAt === null) return state;
  return {
    status: 'paused',
    elapsedMs: state.elapsedMs + Math.max(0, now - state.startedAt),
    startedAt: null,
    suspendedAt: null,
  };
}

export function suspendStopwatch(
  state: StopwatchState,
  monotonicNow: number,
  wallNow: number,
): StopwatchState {
  if (state.status !== 'running' || state.startedAt === null) return state;
  return {
    status: 'suspended',
    elapsedMs: state.elapsedMs + Math.max(0, monotonicNow - state.startedAt),
    startedAt: null,
    suspendedAt: { monotonicMs: monotonicNow, wallMs: wallNow },
  };
}

export function resumeStopwatchAfterSuspension(
  state: StopwatchState,
  monotonicNow: number,
  wallNow: number,
): StopwatchState {
  if (state.status !== 'suspended' || state.suspendedAt === null) return state;

  const monotonicDelta = Math.max(0, monotonicNow - state.suspendedAt.monotonicMs);
  const wallDelta = Math.max(0, wallNow - state.suspendedAt.wallMs);

  return {
    status: 'running',
    elapsedMs: state.elapsedMs + Math.max(monotonicDelta, wallDelta),
    startedAt: monotonicNow,
    suspendedAt: null,
  };
}

export function resetStopwatch(): StopwatchState {
  return createStopwatch();
}

export function elapsedAt(state: StopwatchState, now: number) {
  if (state.status !== 'running' || state.startedAt === null) return state.elapsedMs;
  return state.elapsedMs + Math.max(0, now - state.startedAt);
}

export function formatElapsed(elapsedMs: number) {
  const totalCentiseconds = Math.floor(elapsedMs / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  return [minutes, seconds, centiseconds].map((value) => String(value).padStart(2, '0')).join(':');
}
