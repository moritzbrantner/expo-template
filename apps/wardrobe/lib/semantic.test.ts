import assert from 'node:assert/strict';
import test from 'node:test';

import { rankRelatedItems, wardrobeSimilarity } from './semantic';
import { createWardrobeItem, type WardrobeDraft } from './wardrobe';

const shirt = (
  id: string,
  name: string,
  color: string,
  tags: string[],
  attributes: Partial<WardrobeDraft> = {},
) =>
  createWardrobeItem(
    {
      name,
      category: 'tops',
      color,
      tags,
      notes: '',
      ...attributes,
    },
    id,
  );

test('keeps fully described clothing similarity bounded and inspectable', () => {
  const attributes: Partial<WardrobeDraft> = {
    materials: ['linen', 'cotton'],
    seasons: ['spring', 'summer'],
    occasions: ['work', 'everyday'],
    formality: 'smart-casual',
    fit: 'regular',
  };
  const left = shirt('left', 'Navy Linen Shirt', 'navy', ['linen', 'summer'], attributes);
  const same = shirt('same', 'Navy Linen Shirt', 'navy', ['linen', 'summer'], attributes);
  const different = createWardrobeItem(
    {
      name: 'Running Shoe',
      category: 'footwear',
      color: 'red',
      materials: ['mesh'],
      seasons: ['summer'],
      occasions: ['sport'],
      formality: 'casual',
      fit: 'slim',
      tags: ['sport'],
      notes: '',
    },
    'shoe',
  );

  const identical = wardrobeSimilarity(left, same);
  assert.equal(identical.total, 1);
  assert.deepEqual(
    {
      category: identical.category,
      color: identical.color,
      materials: identical.materials,
      seasons: identical.seasons,
      occasions: identical.occasions,
      formality: identical.formality,
      fit: identical.fit,
      tags: identical.tags,
      name: identical.name,
    },
    {
      category: 1,
      color: 1,
      materials: 1,
      seasons: 1,
      occasions: 1,
      formality: 1,
      fit: 1,
      tags: 1,
      name: 1,
    },
  );
  assert.equal(Object.values(identical.available).every(Boolean), true);

  const unrelated = wardrobeSimilarity(left, different);
  assert.ok(unrelated.total >= 0 && unrelated.total <= 1);
  assert.equal(unrelated.category, 0);
  assert.equal(unrelated.color, 0);
  assert.equal(unrelated.materials, 0);
  assert.equal(unrelated.occasions, 0);
});

test('treats missing structured metadata as unknown rather than dissimilar', () => {
  const left = shirt('left', 'Navy Oxford Shirt', 'navy', []);
  const same = shirt('same', 'Navy Oxford Shirt', 'navy', []);
  const score = wardrobeSimilarity(left, same);

  assert.equal(score.total, 1);
  assert.equal(score.available.materials, false);
  assert.equal(score.available.seasons, false);
  assert.equal(score.available.occasions, false);
  assert.equal(score.available.formality, false);
  assert.equal(score.available.fit, false);
  assert.equal(score.available.tags, false);
});

test('recognizes related colors without treating them as exact matches', () => {
  const navy = shirt('navy', 'Oxford Shirt', 'navy', []);
  const blue = shirt('blue', 'Poplin Shirt', 'blue', []);
  const score = wardrobeSimilarity(navy, blue);

  assert.equal(score.category, 1);
  assert.equal(score.color, 0.5);
  assert.ok(Math.abs(score.total - 0.7727272727272727) < 1e-9);
});

test('uses structured evidence to distinguish otherwise similar pieces', () => {
  const source = shirt('source', 'Navy Shirt', 'navy', [], {
    materials: ['linen'],
    seasons: ['summer'],
    occasions: ['work'],
    formality: 'business',
    fit: 'regular',
  });
  const aligned = shirt('aligned', 'Blue Shirt', 'blue', [], {
    materials: ['linen'],
    seasons: ['summer'],
    occasions: ['work'],
    formality: 'business',
    fit: 'regular',
  });
  const generic = shirt('generic', 'Blue Shirt', 'blue', [], {
    materials: ['wool'],
    seasons: ['winter'],
    occasions: ['home'],
    formality: 'casual',
    fit: 'oversized',
  });

  assert.ok(wardrobeSimilarity(source, aligned).total > wardrobeSimilarity(source, generic).total);
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

  const alphaScore = ranked.find((candidate) => candidate.item.id === 'alpha')?.similarity.total;
  const betaScore = ranked.find((candidate) => candidate.item.id === 'beta')?.similarity.total;
  assert.equal(alphaScore, betaScore);
  assert.deepEqual(
    ranked
      .filter((candidate) => candidate.item.id === 'alpha' || candidate.item.id === 'beta')
      .map((candidate) => candidate.item.id),
    ['alpha', 'beta'],
  );
  assert.equal(ranked.some((candidate) => candidate.item.id === 'shoe'), false);
  assert.deepEqual(rankRelatedItems([source, close], 'missing'), []);
  assert.deepEqual(rankRelatedItems([source, close], source.id, 0), []);
});
