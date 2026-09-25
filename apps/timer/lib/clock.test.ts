import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStopwatch,
  createTimer,
  deserializeClockState,
  pauseStopwatch,
  pauseTimer,
  startStopwatch,
  startTimer,
  stopwatchElapsedMs,
  timerRemainingMs,
} from './clock';

test('timer derives remaining time from wall clock instead of interval ticks', () => {
  const timer = startTimer(createTimer(60_000), 1_000);
  assert.equal(timerRemainingMs(timer, 11_000), 50_000);
  assert.equal(pauseTimer(timer, 11_000).remainingMs, 50_000);
  assert.equal(timerRemainingMs(timer, 71_000), 0);
});

test('stopwatch accumulates across start and pause cycles', () => {
  const first = pauseStopwatch(startStopwatch(createStopwatch(), 1_000), 4_500);
  const second = startStopwatch(first, 10_000);
  assert.equal(stopwatchElapsedMs(second, 12_000), 5_500);
});

test('malformed persisted state falls back deterministically', () => {
  const fallback = deserializeClockState('{broken', 300_000);
  assert.equal(fallback.timer.remainingMs, 300_000);
  assert.equal(fallback.stopwatch.elapsedMs, 0);
});
