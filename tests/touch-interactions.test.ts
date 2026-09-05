import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  isFlick,
  normalizeSelectionRect,
  precisionScaleForOffset,
  radialActionIndex,
  repeatIntervalForElapsed,
  resolveReachPlacement,
  snapValue,
  TOUCH_INTERACTION_POLICY,
  valueFromTrackPosition,
} from '../lib/touch-interactions';

test('touch targets and gesture thresholds have conservative defaults', () => {
  assert.equal(TOUCH_INTERACTION_POLICY.minimumTargetSize, 44);
  assert.equal(TOUCH_INTERACTION_POLICY.swipeThreshold >= 64, true);
  assert.equal(TOUCH_INTERACTION_POLICY.flickVelocity >= 800, true);
});

test('snapValue clamps and snaps without floating point drift', () => {
  assert.equal(snapValue(4.74, 0, 10, 0.5), 4.5);
  assert.equal(snapValue(11, 0, 10, 1), 10);
  assert.equal(snapValue(-2, 0, 10, 1), 0);
  assert.throws(() => snapValue(2, 0, 10, 0), /positive/);
});

test('track positions map deterministically into snapped values', () => {
  assert.equal(valueFromTrackPosition(0, 200, 0, 10, 1), 0);
  assert.equal(valueFromTrackPosition(100, 200, 0, 10, 1), 5);
  assert.equal(valueFromTrackPosition(210, 200, 0, 10, 1), 10);
});

test('precision scrubber uses vertical distance for fine and coarse control', () => {
  assert.equal(precisionScaleForOffset(-60), 0.1);
  assert.equal(precisionScaleForOffset(0), 1);
  assert.equal(precisionScaleForOffset(60), 10);
});

test('repeat interval accelerates but stays bounded', () => {
  const initial = repeatIntervalForElapsed(0);
  const accelerated = repeatIntervalForElapsed(2_800);
  const saturated = repeatIntervalForElapsed(30_000);
  assert.equal(accelerated < initial, true);
  assert.equal(saturated, TOUCH_INTERACTION_POLICY.repeatMinimumIntervalMs);
});

test('radial menu honors its dead zone and divides actions by direction', () => {
  assert.equal(radialActionIndex(2, 2, 4), null);
  assert.equal(radialActionIndex(50, 0, 4), 0);
  assert.equal(radialActionIndex(0, 50, 4), 1);
  assert.equal(radialActionIndex(-50, 0, 4), 2);
  assert.equal(radialActionIndex(0, -50, 4), 3);
});

test('flick detection uses velocity magnitude', () => {
  assert.equal(isFlick(100, 100), false);
  assert.equal(isFlick(900, 0), true);
  assert.equal(isFlick(650, 650), true);
});

test('reach overlays open away from the initiating finger', () => {
  assert.equal(resolveReachPlacement({ x: 20, y: 20 }, 200, 400), 'down-right');
  assert.equal(resolveReachPlacement({ x: 180, y: 380 }, 200, 400), 'up-left');
});

test('selection geometry normalizes any drag direction', () => {
  assert.deepEqual(normalizeSelectionRect({ x: 80, y: 90 }, { x: 20, y: 30 }), {
    x: 20,
    y: 30,
    width: 60,
    height: 60,
  });
});

test('root layout installs the gesture-handler ownership boundary', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const rootLayout = readFileSync(path.join(repoRoot, 'app', '_layout.tsx'), 'utf8');
  assert.match(rootLayout, /GestureHandlerRootView/);
  assert.match(rootLayout, /style=\{\{ flex: 1 \}\}/);
});

test('press-only interactions expose atomic accessibility activation', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const source = readFileSync(path.join(repoRoot, 'components', 'touch', 'press-controls.tsx'), 'utf8');
  const repeatButton = source.slice(
    source.indexOf('export function RepeatButton'),
    source.indexOf('type HoldActionProps'),
  );
  const holdAction = source.slice(
    source.indexOf('export function HoldAction'),
    source.indexOf('type StepControlProps'),
  );

  for (const control of [repeatButton, holdAction]) {
    assert.match(control, /accessibilityActions=\{\[\{ name: 'activate'/);
    assert.match(control, /onAccessibilityAction=/);
    assert.match(control, /actionName === 'activate'/);
    assert.match(control, /!disabled/);
  }

  assert.match(repeatButton, /invoke\(\);/);
  assert.match(holdAction, /activate\(\);/);
});

test('touch layer exports every interaction family and documents visible fallbacks', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const indexSource = readFileSync(path.join(repoRoot, 'components', 'touch', 'index.ts'), 'utf8');
  const docs = readFileSync(path.join(repoRoot, 'components', 'touch', 'README.md'), 'utf8');

  for (const symbol of [
    'RepeatButton',
    'HoldAction',
    'StepControl',
    'SegmentedChoice',
    'SwipeActions',
    'DragHandle',
    'ThumbSlider',
    'RadialMenu',
    'BottomActionShelf',
    'EdgeHandle',
    'DragSurface',
    'FlickSurface',
    'PrecisionScrubber',
    'PinchSurface',
    'ViewportSurface',
    'GestureSelection',
    'GestureUndo',
    'ReachOverlay',
    'DragConfirm',
    'TouchPreview',
    'Magnifier',
    'RemoteHandle',
  ]) {
    assert.match(indexSource, new RegExp(`\\b${symbol}\\b`));
  }

  assert.match(docs, /hidden gesture may accelerate a workflow but must not be the only route/i);
  assert.match(docs, /One finger manipulates content; two fingers manipulate the viewport/i);
  assert.match(docs, /commit on release/i);
});
