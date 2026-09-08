import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

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
  color: ' sky blue ',
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

    assert.equal(entry.id, 'group-1');
    assert.equal(entry.name, 'Blue bodysuits');
    assert.equal(entry.brand, 'Brand Name');
    assert.equal(entry.color, 'sky blue');
    assert.equal(entry.originalSizeLabel, '0–3 M');
    assert.deepEqual(entry.normalizedSize, { minCm: 56, maxCm: 62 });
    assert.equal(entry.quantity, 3);
    assert.equal(entry.notes, 'drawer one');
  });

  test('single entries always represent exactly one garment', () => {
    const entry = createBabyClothingEntry(
      { ...baseDraft, entryType: 'single', quantity: 9 },
      'single-1',
    );
    assert.equal(entry.quantity, 1);
  });

  test('group quantities must be positive whole numbers', () => {
    assert.throws(
      () => createBabyClothingEntry({ ...baseDraft, quantity: 0 }, 'group-0'),
      /positive whole number/,
    );
  });

  test('size formatting and overlap stay deterministic', () => {
    assert.equal(formatBabyClothingSize({ minCm: 62, maxCm: 68 }), '62–68 cm');
    assert.equal(sizeRangesOverlap({ minCm: 56, maxCm: 62 }, { minCm: 62, maxCm: 68 }), true);
    assert.equal(sizeRangesOverlap({ minCm: 50, maxCm: 56 }, { minCm: 62, maxCm: 68 }), false);
  });

  test('filters by lifecycle and normalized size without using printed labels as authority', () => {
    const small = createBabyClothingEntry(baseDraft, 'small');
    const large = createBabyClothingEntry(
      {
        ...baseDraft,
        name: 'Winter suit',
        color: 'cream',
        originalSizeLabel: '6–9 months',
        normalizedSize: { minCm: 68, maxCm: 74 },
        status: 'too-large',
      },
      'large',
    );

    assert.deepEqual(
      filterBabyClothingEntries(
        [large, small],
        '',
        'in-use',
        BABY_CLOTHING_SIZE_PRESETS[2],
      ).map((entry) => entry.id),
      ['small'],
    );
    assert.deepEqual(
      filterBabyClothingEntries([large, small], 'cream', 'all', null).map((entry) => entry.id),
      ['large'],
    );
  });

  test('hydrates pre-color entries without invalidating existing local inventory', () => {
    const current = createBabyClothingEntry(baseDraft, 'legacy', new Date('2026-09-05T10:00:00Z'));
    const legacy = { ...current } as Partial<typeof current>;
    delete legacy.color;

    const [hydrated] = deserializeBabyClothingEntries(JSON.stringify([legacy]));
    assert.ok(hydrated);
    assert.equal(hydrated.id, 'legacy');
    assert.equal(hydrated.color, '');
  });

  test('deserialization rejects malformed entries instead of manufacturing inventory', () => {
    const valid = createBabyClothingEntry(baseDraft, 'valid', new Date('2026-09-05T10:00:00Z'));
    const malformed = { ...valid, status: 'lost-somewhere' };

    assert.deepEqual(deserializeBabyClothingEntries(JSON.stringify([malformed, valid])), [valid]);
    assert.deepEqual(deserializeBabyClothingEntries('{'), []);
  });
});
