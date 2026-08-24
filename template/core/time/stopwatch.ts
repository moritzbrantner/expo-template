export type StopwatchState = {
  status: 'idle' | 'running' | 'paused';
  elapsedMs: number;
  startedAt: number | null;
};

export function createStopwatch(): StopwatchState {
  return { status: 'idle', elapsedMs: 0, startedAt: null };
}

export function startStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.status === 'running') return state;
  return { ...state, status: 'running', startedAt: now };
}

export function pauseStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.status !== 'running' || state.startedAt === null) return state;
  return {
    status: 'paused',
    elapsedMs: state.elapsedMs + Math.max(0, now - state.startedAt),
    startedAt: null,
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
