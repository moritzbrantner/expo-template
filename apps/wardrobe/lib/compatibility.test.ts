import assert from 'node:assert/strict';
import test from 'node:test';

import { wardrobeSimilarity } from './semantic';
import {
  canLayer,
  createWardrobeRelation,
  deserializeWardrobeRelations,
  hasWardrobeRelation,
  suggestOutfits,
  toggleWardrobeRelation,
  wardrobeCompatibility,
  wardrobeRelationId,
} from './compatibility';
import { createWardrobeItem, type WardrobeDraft } from './wardrobe';

function item(id: string, draft: Partial<WardrobeDraft> & Pick<WardrobeDraft, 'name' | 'category' | 'color'>) {
  return createWardrobeItem(
    {
      tags: [],
      notes: '',
      ...draft,
    },
    id,
  );
}

test('canonicalizes, toggles, deduplicates, and prunes explicit relations', () => {
  const created = createWardrobeRelation(
    'pairs-with',
    'trousers',
    'shirt',
    new Date('2026-09-04T08:00:00.000Z'),
  );
  assert.equal(created.leftId, 'shirt');
  assert.equal(created.rightId, 'trousers');
  assert.equal(created.id, wardrobeRelationId('pairs-with', 'shirt', 'trousers'));

  const added = toggleWardrobeRelation([], 'pairs-with', 'shirt', 'trousers');
  assert.equal(added.length, 1);
  assert.equal(hasWardrobeRelation(added, 'pairs-with', 'trousers', 'shirt'), true);
  assert.deepEqual(toggleWardrobeRelation(added, 'pairs-with', 'trousers', 'shirt'), []);

  const hydrated = deserializeWardrobeRelations(
    JSON.stringify([created, { ...created, id: 'wrong-id' }, { ...created, rightId: 'missing' }]),
    ['shirt', 'trousers'],
  );
  assert.deepEqual(hydrated, [created]);
  assert.throws(() => createWardrobeRelation('pairs-with', 'shirt', 'shirt'), /itself/i);
});

test('keeps similarity distinct from outfit compatibility', () => {
  const shirt = item('shirt', {
    name: 'Navy Oxford Shirt',
    category: 'tops',
    color: 'navy',
    seasons: ['autumn'],
    occasions: ['work'],
    formality: 'business',
  });
  const tee = item('tee', {
    name: 'Navy Tee',
    category: 'tops',
    color: 'navy',
    seasons: ['autumn'],
    occasions: ['work'],
    formality: 'business',
  });
  const trousers = item('trousers', {
    name: 'Grey Wool Trousers',
    category: 'bottoms',
    color: 'grey',
    seasons: ['autumn'],
    occasions: ['work'],
    formality: 'business',
  });

  assert.ok(wardrobeSimilarity(shirt, tee).total > wardrobeSimilarity(shirt, trousers).total);
  assert.ok(wardrobeCompatibility(shirt, trousers).total > wardrobeCompatibility(shirt, tee).total);
  assert.equal(wardrobeCompatibility(shirt, trousers).reasons.includes('complementary categories'), true);
});

test('explicit pair and layer relations boost but do not replace compatibility', () => {
  const coat = item('coat', {
    name: 'Wool Coat',
    category: 'outerwear',
    color: 'brown',
    seasons: ['winter'],
    occasions: ['work'],
    formality: 'business',
  });
  const shirt = item('shirt', {
    name: 'Oxford Shirt',
    category: 'tops',
    color: 'white',
    seasons: ['winter'],
    occasions: ['work'],
    formality: 'business',
  });

  assert.equal(canLayer(coat, shirt), true);
  const baseline = wardrobeCompatibility(coat, shirt).total;
  const relations = [
    createWardrobeRelation('pairs-with', coat.id, shirt.id),
    createWardrobeRelation('layered-with', coat.id, shirt.id),
  ];
  const boosted = wardrobeCompatibility(coat, shirt, relations);
  assert.ok(boosted.total > baseline);
  assert.equal(boosted.pairsWith, true);
  assert.equal(boosted.layeredWith, true);
  assert.deepEqual(boosted.reasons.slice(0, 2), ['explicit pair', 'explicit layer']);
});

test('builds deterministic category-complete outfit suggestions around a source piece', () => {
  const blazer = item('blazer', {
    name: 'Navy Blazer',
    category: 'outerwear',
    color: 'navy',
    seasons: ['spring', 'autumn'],
    occasions: ['work'],
    formality: 'business',
  });
  const shirt = item('shirt', {
    name: 'White Oxford Shirt',
    category: 'tops',
    color: 'white',
    seasons: ['spring', 'autumn'],
    occasions: ['work'],
    formality: 'business',
  });
  const trousers = item('trousers', {
    name: 'Grey Trousers',
    category: 'bottoms',
    color: 'grey',
    seasons: ['spring', 'autumn'],
    occasions: ['work'],
    formality: 'business',
  });
  const shoes = item('shoes', {
    name: 'Brown Oxfords',
    category: 'footwear',
    color: 'brown',
    seasons: ['spring', 'autumn'],
    occasions: ['work'],
    formality: 'business',
  });
  const running = item('running', {
    name: 'Red Running Shoe',
    category: 'footwear',
    color: 'red',
    seasons: ['summer'],
    occasions: ['sport'],
    formality: 'casual',
  });
  const relations = [createWardrobeRelation('pairs-with', blazer.id, shirt.id)];

  const first = suggestOutfits([running, trousers, blazer, shoes, shirt], blazer.id, relations, 3);
  const second = suggestOutfits([shirt, shoes, blazer, trousers, running], blazer.id, relations, 3);

  assert.ok(first.length > 0);
  assert.deepEqual(first[0]?.items.map((entry) => entry.id), ['blazer', 'shirt', 'trousers', 'shoes']);
  assert.equal(first[0]?.items.some((entry) => entry.id === 'running'), false);
  assert.deepEqual(first.map((outfit) => outfit.id), second.map((outfit) => outfit.id));
  assert.deepEqual(suggestOutfits([blazer, shirt], 'missing', relations), []);
  assert.deepEqual(suggestOutfits([blazer, shirt], blazer.id, relations, 0), []);
});
