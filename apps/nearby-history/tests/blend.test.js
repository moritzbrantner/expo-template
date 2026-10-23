import { describe, expect, test } from 'bun:test';

import { blendLabel, clampBlend } from '../lib/blend';
import { calibrationSummary, HORIZON_ONE_SITE } from '../lib/site';

describe('historical blend', () => {
  test('clamps invalid and out-of-range values deterministically', () => {
    expect(clampBlend(Number.NaN)).toBe(0);
    expect(clampBlend(-0.4)).toBe(0);
    expect(clampBlend(0.35)).toBe(0.35);
    expect(clampBlend(1.7)).toBe(1);
  });

  test('formats the visible past percentage from the clamped value', () => {
    expect(blendLabel(0)).toBe('0% past');
    expect(blendLabel(0.684)).toBe('68% past');
    expect(blendLabel(4)).toBe('100% past');
  });
});

describe('manual calibration fixture', () => {
  test('is explicitly non-historical until a sourced reconstruction replaces it', () => {
    expect(HORIZON_ONE_SITE.evidence.kind).toBe('technical-demo');
    expect(HORIZON_ONE_SITE.evidence.note).toContain('not a historical claim');
  });

  test('has a stable human-readable transform for field notes', () => {
    expect(calibrationSummary(HORIZON_ONE_SITE)).toBe(
      'P 0.00, -1.25, -6.00 · R 0.00, 0.00, 0.00 · S 1.00, 1.00, 1.00',
    );
  });
});
