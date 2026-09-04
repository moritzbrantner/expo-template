import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWardrobeItem,
  deserializeWardrobeItems,
  filterWardrobeItems,
  normalizeTags,
  normalizeWardrobeText,
  parseList,
  parseTags,
  updateWardrobeItem,
  type WardrobeItem,
} from './wardrobe';

test('normalizes item text and list-style attributes', () => {
  assert.equal(normalizeWardrobeText('  Navy\t linen   shirt '), 'Navy linen shirt');
  assert.deepEqual(normalizeTags([' Summer ', 'LINEN', 'summer', '', ' smart casual ']), [
    'summer',
    'linen',
    'smart casual',
  ]);
  assert.deepEqual(parseTags('Summer, linen, summer, smart casual'), [
    'summer',
    'linen',
    'smart casual',
  ]);
  assert.deepEqual(parseList('Cotton, linen, cotton'), ['cotton', 'linen']);
});

test('creates deterministic normalized wardrobe items with structured attributes', () => {
  const item = createWardrobeItem(
    {
      name: '  Navy   Linen Shirt ',
      category: 'tops',
      color: ' Navy ',
      materials: [' Linen ', 'COTTON', 'linen'],
      seasons: ['summer', 'spring', 'summer'],
      occasions: ['work', 'everyday', 'work'],
      formality: 'smart-casual',
      fit: 'regular',
      tags: ['Summer', 'linen', 'summer'],
      notes: '  Good for warm days.  ',
    },
    'shirt-1',
    new Date('2026-09-04T08:00:00.000Z'),
  );

  assert.deepEqual(item, {
    id: 'shirt-1',
    name: 'Navy Linen Shirt',
    category: 'tops',
    color: 'navy',
    materials: ['linen', 'cotton'],
    seasons: ['summer', 'spring'],
    occasions: ['work', 'everyday'],
    formality: 'smart-casual',
    fit: 'regular',
    tags: ['summer', 'linen'],
    notes: 'Good for warm days.',
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T08:00:00.000Z',
  });
  assert.throws(
    () =>
      createWardrobeItem(
        { name: ' ', category: 'tops', color: 'navy', tags: [], notes: '' },
        'x',
      ),
    /cannot be empty/i,
  );
});

test('edits structured fields while preserving stable identity and creation time', () => {
  const item = createWardrobeItem(
    {
      name: 'Navy Shirt',
      category: 'tops',
      color: 'navy',
      materials: ['cotton'],
      seasons: ['summer'],
      occasions: ['everyday'],
      formality: 'casual',
      fit: 'regular',
      tags: ['summer'],
      notes: '',
    },
    'shirt-1',
    new Date('2026-09-04T08:00:00.000Z'),
  );

  const updated = updateWardrobeItem(
    item,
    {
      name: '  Blue   Linen Shirt ',
      color: ' Blue ',
      materials: ['LINEN', 'linen', 'cotton'],
      seasons: ['spring', 'summer'],
      occasions: ['work'],
      formality: 'business',
      fit: 'slim',
      tags: ['LINEN', 'linen', 'work'],
      notes: '  Better with chinos. ',
    },
    new Date('2026-09-04T09:30:00.000Z'),
  );

  assert.deepEqual(updated, {
    id: 'shirt-1',
    name: 'Blue Linen Shirt',
    category: 'tops',
    color: 'blue',
    materials: ['linen', 'cotton'],
    seasons: ['spring', 'summer'],
    occasions: ['work'],
    formality: 'business',
    fit: 'slim',
    tags: ['linen', 'work'],
    notes: 'Better with chinos.',
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T09:30:00.000Z',
  });
  assert.equal(item.name, 'Navy Shirt');
});

test('preserves custom colors across edits and storage hydration', () => {
  const item = createWardrobeItem(
    {
      name: 'Teal Overshirt',
      category: 'tops',
      color: ' Teal ',
      tags: [],
      notes: '',
    },
    'overshirt-1',
    new Date('2026-09-04T08:00:00.000Z'),
  );

  assert.equal(item.color, 'teal');

  const updated = updateWardrobeItem(
    item,
    { notes: 'Layering piece' },
    new Date('2026-09-04T09:00:00.000Z'),
  );
  assert.equal(updated.color, 'teal');
  assert.equal(updated.notes, 'Layering piece');

  assert.equal(deserializeWardrobeItems(JSON.stringify([updated]))[0]?.color, 'teal');
});

test('hydrates legacy entries with neutral structured defaults', () => {
  const legacy = {
    id: '  coat-1 ',
    name: '  Wool   Coat ',
    category: 'outerwear',
    color: ' Brown ',
    tags: ['Winter', 'winter', 'Formal'],
    notes: '  Heavy coat. ',
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T08:00:00.000Z',
  };

  assert.deepEqual(deserializeWardrobeItems(JSON.stringify([legacy])), [
    {
      ...legacy,
      id: 'coat-1',
      name: 'Wool Coat',
      color: 'brown',
      materials: [],
      seasons: [],
      occasions: [],
      formality: null,
      fit: null,
      tags: ['winter', 'formal'],
      notes: 'Heavy coat.',
    },
  ]);
});

test('hydrates enriched entries and drops malformed structured storage', () => {
  const valid: WardrobeItem = {
    id: 'coat-1',
    name: 'Wool Coat',
    category: 'outerwear',
    color: 'brown',
    materials: [' Wool ', 'wool'],
    seasons: ['winter'],
    occasions: ['work', 'formal'],
    formality: 'formal',
    fit: 'regular',
    tags: ['Winter'],
    notes: ' Heavy coat. ',
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T08:00:00.000Z',
  };
  const malformed = { ...valid, seasons: ['monsoon'] };

  assert.deepEqual(deserializeWardrobeItems(JSON.stringify([malformed, valid])), [
    {
      ...valid,
      materials: ['wool'],
      tags: ['winter'],
      notes: 'Heavy coat.',
    },
  ]);
  assert.deepEqual(deserializeWardrobeItems('{broken'), []);
  assert.deepEqual(deserializeWardrobeItems(JSON.stringify({ not: 'an array' })), []);
  assert.deepEqual(deserializeWardrobeItems(null), []);
});

test('filters by category and all searchable clothing evidence without reordering', () => {
  const shirt = createWardrobeItem(
    {
      name: 'Blue Oxford Shirt',
      category: 'tops',
      color: 'blue',
      materials: ['cotton'],
      seasons: ['spring'],
      occasions: ['work'],
      formality: 'business',
      fit: 'slim',
      tags: ['office'],
      notes: '',
    },
    'shirt',
  );
  const jeans = createWardrobeItem(
    {
      name: 'Straight Jeans',
      category: 'bottoms',
      color: 'denim',
      materials: ['denim'],
      seasons: ['autumn'],
      occasions: ['everyday'],
      formality: 'casual',
      fit: 'regular',
      tags: ['casual'],
      notes: '',
    },
    'jeans',
  );
  const coat = createWardrobeItem(
    {
      name: 'Wool Coat',
      category: 'outerwear',
      color: 'brown',
      materials: ['wool'],
      seasons: ['winter'],
      occasions: ['formal'],
      formality: 'formal',
      fit: 'regular',
      tags: ['tailored'],
      notes: 'Work meetings',
    },
    'coat',
  );
  const source = [shirt, jeans, coat];

  assert.deepEqual(filterWardrobeItems(source, '', 'all').map((item) => item.id), [
    'shirt',
    'jeans',
    'coat',
  ]);
  assert.deepEqual(filterWardrobeItems(source, '', 'tops').map((item) => item.id), ['shirt']);
  assert.deepEqual(filterWardrobeItems(source, 'work', 'all').map((item) => item.id), [
    'shirt',
    'coat',
  ]);
  assert.deepEqual(filterWardrobeItems(source, 'wool', 'all').map((item) => item.id), ['coat']);
  assert.deepEqual(filterWardrobeItems(source, 'autumn', 'all').map((item) => item.id), ['jeans']);
  assert.deepEqual(filterWardrobeItems(source, 'business', 'all').map((item) => item.id), ['shirt']);
  assert.deepEqual(filterWardrobeItems(source, 'slim', 'all').map((item) => item.id), ['shirt']);
});
