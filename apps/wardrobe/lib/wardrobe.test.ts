import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWardrobeItem,
  deserializeWardrobeItems,
  filterWardrobeItems,
  normalizeTags,
  normalizeWardrobeText,
  parseTags,
  updateWardrobeItem,
  type WardrobeItem,
} from './wardrobe';

test('normalizes item text and tags', () => {
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
});

test('creates deterministic normalized wardrobe items', () => {
  const item = createWardrobeItem(
    {
      name: '  Navy   Linen Shirt ',
      category: 'tops',
      color: ' Navy ',
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

test('edits normalized fields while preserving stable identity and creation time', () => {
  const item = createWardrobeItem(
    {
      name: 'Navy Shirt',
      category: 'tops',
      color: 'navy',
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
    tags: ['linen', 'work'],
    notes: 'Better with chinos.',
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T09:30:00.000Z',
  });
  assert.equal(item.name, 'Navy Shirt');
});

test('hydrates valid entries, normalizes them, and drops malformed storage', () => {
  const valid: WardrobeItem = {
    id: '  coat-1 ',
    name: '  Wool   Coat ',
    category: 'outerwear',
    color: ' Brown ',
    tags: ['Winter', 'winter', 'Formal'],
    notes: '  Heavy coat. ',
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T08:00:00.000Z',
  };
  const malformed = { ...valid, category: 'furniture' };

  assert.deepEqual(deserializeWardrobeItems(JSON.stringify([malformed, valid])), [
    {
      ...valid,
      id: 'coat-1',
      name: 'Wool Coat',
      color: 'brown',
      tags: ['winter', 'formal'],
      notes: 'Heavy coat.',
    },
  ]);
  assert.deepEqual(deserializeWardrobeItems('{broken'), []);
  assert.deepEqual(deserializeWardrobeItems(JSON.stringify({ not: 'an array' })), []);
  assert.deepEqual(deserializeWardrobeItems(null), []);
});

test('filters by category and searchable clothing evidence without reordering', () => {
  const shirt = createWardrobeItem(
    { name: 'Blue Oxford Shirt', category: 'tops', color: 'blue', tags: ['work'], notes: '' },
    'shirt',
  );
  const jeans = createWardrobeItem(
    { name: 'Straight Jeans', category: 'bottoms', color: 'denim', tags: ['casual'], notes: '' },
    'jeans',
  );
  const coat = createWardrobeItem(
    {
      name: 'Wool Coat',
      category: 'outerwear',
      color: 'brown',
      tags: ['formal'],
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
});
