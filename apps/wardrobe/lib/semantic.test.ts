import assert from 'node:assert/strict';
import test from 'node:test';

import { rankRelatedItems, wardrobeSimilarity } from './semantic';
import { createWardrobeItem } from './wardrobe';

const shirt = (id: string, name: string, color: string, tags: string[]) =>
  createWardrobeItem({ name, category: 'tops', color, tags, notes: '' }, id);

test('keeps clothing similarity bounded and inspectable', () => {
  const left = shirt('left', 'Navy Linen Shirt', 'navy', ['linen', 'summer']);
  const same = shirt('same', 'Navy Linen Shirt', 'navy', ['linen', 'summer']);
  const different = createWardrobeItem(
    { name: 'Running Shoe', category: 'footwear', color: 'red', tags: ['sport'], notes: '' },
    'shoe',
  );

  assert.deepEqual(wardrobeSimilarity(left, same), {
    total: 1,
    category: 1,
    color: 1,
    tags: 1,
    name: 1,
  });
  const unrelated = wardrobeSimilarity(left, different);
  assert.equal(unrelated.total, 0);
  assert.ok(unrelated.total >= 0 && unrelated.total <= 1);
});

test('recognizes related colors without treating them as exact matches', () => {
  const navy = shirt('navy', 'Oxford Shirt', 'navy', []);
  const blue = shirt('blue', 'Poplin Shirt', 'blue', []);
  const score = wardrobeSimilarity(navy, blue);

  assert.equal(score.category, 1);
  assert.equal(score.color, 0.5);
  assert.ok(Math.abs(score.total - 0.55) < 1e-9);
});

test('ranks related pieces deterministically and excludes unrelated pieces', () => {
  const source = shirt('source', 'Navy Linen Shirt', 'navy', ['linen', 'summer']);
  const close = shirt('close', 'Blue Linen Shirt', 'blue', ['linen', 'summer']);
  const alpha = shirt('alpha', 'Cotton Tee A', 'white', []);
  const beta = shirt('beta', 'Cotton Tee B', 'white', []);
  const shoe = createWardrobeItem(
    { name: 'Running Shoe', category: 'footwear', color: 'red', tags: ['sport'], notes: '' },
    'shoe',
  );

  const ranked = rankRelatedItems([source, beta, shoe, close, alpha], source.id, 4);
  assert.equal(ranked[0]?.item.id, 'close');
  assert.deepEqual(
    ranked.filter((candidate) => candidate.similarity.total === 0.45).map((candidate) => candidate.item.id),
    ['alpha', 'beta'],
  );
  assert.equal(ranked.some((candidate) => candidate.item.id === 'shoe'), false);
  assert.deepEqual(rankRelatedItems([source, close], 'missing'), []);
  assert.deepEqual(rankRelatedItems([source, close], source.id, 0), []);
});
