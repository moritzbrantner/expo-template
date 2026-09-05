import { describe, expect, test } from 'bun:test';

import {
  BABY_CLOTHING_SIZE_PRESETS,
  createBabyClothingEntry,
  deserializeBabyClothingEntries,
  filterBabyClothingEntries,
  formatBabyClothingSize,
  sizeRangesOverlap,
} from './clothing';

const baseDraft = {
  name: '  Blue   bodysuits ',
  category: 'bodysuit' as const,
  brand: '  Brand Name ',
  originalSizeLabel: ' 0–3 M ',
  normalizedSize: { minCm: 56, maxCm: 62 },
  entryType: 'group' as const,
  quantity: 3,
  status: 'in-use' as const,
  photos: [],
  notes: ' drawer one ',
};

describe('baby clothing model', () => {
  test('keeps printed size evidence while normalizing sortable range and grouped quantity', () => {
    const entry = createBabyClothingEntry(baseDraft, ' group-1 ', new Date('2026-09-05T10:00:00Z'));

    expect(entry.id).toBe('group-1');
    expect(entry.name).toBe('Blue bodysuits');
    expect(entry.brand).toBe('Brand Name');
    expect(entry.originalSizeLabel).toBe('0–3 M');
    expect(entry.normalizedSize).toEqual({ minCm: 56, maxCm: 62 });
    expect(entry.quantity).toBe(3);
    expect(entry.notes).toBe('drawer one');
  });

  test('single entries always represent exactly one garment', () => {
    const entry = createBabyClothingEntry(
      { ...baseDraft, entryType: 'single', quantity: 9 },
      'single-1',
    );
    expect(entry.quantity).toBe(1);
  });

  test('group quantities must be positive whole numbers', () => {
    expect(() =>
      createBabyClothingEntry({ ...baseDraft, quantity: 0 }, 'group-0'),
    ).toThrow('positive whole number');
  });

  test('size formatting and overlap stay deterministic', () => {
    expect(formatBabyClothingSize({ minCm: 62, maxCm: 68 })).toBe('62–68 cm');
    expect(sizeRangesOverlap({ minCm: 56, maxCm: 62 }, { minCm: 62, maxCm: 68 })).toBe(true);
    expect(sizeRangesOverlap({ minCm: 50, maxCm: 56 }, { minCm: 62, maxCm: 68 })).toBe(false);
  });

  test('filters by lifecycle and normalized size without using printed labels as authority', () => {
    const small = createBabyClothingEntry(baseDraft, 'small');
    const large = createBabyClothingEntry(
      {
        ...baseDraft,
        name: 'Winter suit',
        originalSizeLabel: '6–9 months',
        normalizedSize: { minCm: 68, maxCm: 74 },
        status: 'too-large',
      },
      'large',
    );

    expect(
      filterBabyClothingEntries(
        [large, small],
        '',
        'in-use',
        BABY_CLOTHING_SIZE_PRESETS[2],
      ).map((entry) => entry.id),
    ).toEqual(['small']);
  });

  test('deserialization rejects malformed entries instead of manufacturing inventory', () => {
    const valid = createBabyClothingEntry(baseDraft, 'valid', new Date('2026-09-05T10:00:00Z'));
    const malformed = { ...valid, status: 'lost-somewhere' };

    expect(deserializeBabyClothingEntries(JSON.stringify([malformed, valid]))).toEqual([valid]);
    expect(deserializeBabyClothingEntries('{')).toEqual([]);
  });
});
