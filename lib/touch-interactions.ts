export type TouchPoint = {
  x: number;
  y: number;
};

export type TouchRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ReachPlacement = 'up-left' | 'up-right' | 'down-left' | 'down-right';

export const TOUCH_INTERACTION_POLICY = {
  minimumTargetSize: 44,
  radialDeadZone: 28,
  swipeThreshold: 72,
  flickVelocity: 850,
  longPressDelayMs: 320,
  repeatInitialDelayMs: 360,
  repeatIntervalMs: 140,
  repeatMinimumIntervalMs: 55,
} as const;

function orderedBounds(first: number, second: number) {
  return first <= second ? ([first, second] as const) : ([second, first] as const);
}

export function clampNumber(value: number, firstBound: number, secondBound: number) {
  const [minimum, maximum] = orderedBounds(firstBound, secondBound);
  return Math.min(maximum, Math.max(minimum, value));
}

export function snapValue(value: number, min: number, max: number, step: number) {
  if (!Number.isFinite(step) || step <= 0) {
    throw new Error('step must be a finite positive number');
  }

  const clamped = clampNumber(value, min, max);
  const stepsFromMin = Math.round((clamped - min) / step);
  const snapped = min + stepsFromMin * step;
  const precision = Math.max(0, `${step}`.split('.')[1]?.length ?? 0);
  return Number(clampNumber(snapped, min, max).toFixed(precision));
}

export function precisionScaleForOffset(offsetY: number, fineThreshold = -48, coarseThreshold = 48) {
  if (offsetY <= fineThreshold) {
    return 0.1;
  }
  if (offsetY >= coarseThreshold) {
    return 10;
  }
  return 1;
}

export function repeatIntervalForElapsed(
  elapsedMs: number,
  baseIntervalMs: number = TOUCH_INTERACTION_POLICY.repeatIntervalMs,
  minimumIntervalMs: number = TOUCH_INTERACTION_POLICY.repeatMinimumIntervalMs,
) {
  const accelerationSteps = Math.max(0, Math.floor(elapsedMs / 700));
  return Math.max(minimumIntervalMs, Math.round(baseIntervalMs * 0.84 ** accelerationSteps));
}

export function radialActionIndex(
  deltaX: number,
  deltaY: number,
  actionCount: number,
  deadZone: number = TOUCH_INTERACTION_POLICY.radialDeadZone,
) {
  if (!Number.isInteger(actionCount) || actionCount <= 0) {
    return null;
  }

  if (Math.hypot(deltaX, deltaY) < deadZone) {
    return null;
  }

  const fullTurn = Math.PI * 2;
  const slice = fullTurn / actionCount;
  const angle = (Math.atan2(deltaY, deltaX) + fullTurn) % fullTurn;
  return Math.floor(((angle + slice / 2) % fullTurn) / slice);
}

export function isFlick(
  velocityX: number,
  velocityY: number,
  threshold: number = TOUCH_INTERACTION_POLICY.flickVelocity,
) {
  return Math.hypot(velocityX, velocityY) >= threshold;
}

export function resolveReachPlacement(
  point: TouchPoint,
  width: number,
  height: number,
): ReachPlacement {
  const horizontal = point.x < width / 2 ? 'right' : 'left';
  const vertical = point.y < height / 2 ? 'down' : 'up';
  return `${vertical}-${horizontal}` as ReachPlacement;
}

export function normalizeSelectionRect(start: TouchPoint, end: TouchPoint): TouchRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function valueFromTrackPosition(
  x: number,
  width: number,
  min: number,
  max: number,
  step: number,
) {
  if (width <= 0) {
    return snapValue(min, min, max, step);
  }
  const ratio = clampNumber(x / width, 0, 1);
  return snapValue(min + ratio * (max - min), min, max, step);
}
