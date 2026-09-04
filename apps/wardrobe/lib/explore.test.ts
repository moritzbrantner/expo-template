import assert from 'node:assert/strict';
import test from 'node:test';

import { exploreWardrobe } from './explore';
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

test('finds deterministic semantic clusters and isolated pieces', () => {
  const navy = item('navy', {
    name: 'Navy Linen Shirt',
    category: 'tops',
    color: 'navy',
    materials: ['linen'],
    seasons: ['summer'],
    occasions: ['work'],
    formality: 'smart-casual',
    fit: 'regular',
    tags: ['minimal'],
  });
  const blue = item('blue', {
    name: 'Blue Linen Shirt',
    category: 'tops',
    color: 'blue',
    materials: ['linen'],
    seasons: ['summer'],
    occasions: ['work'],
    formality: 'smart-casual',
    fit: 'regular',
    tags: ['minimal'],
  });
  const shoe = item('shoe', {
    name: 'Red Running Shoe',
    category: 'footwear',
    color: 'red',
    materials: ['mesh'],
    seasons: ['spring'],
    occasions: ['sport'],
    formality: 'casual',
    fit: 'regular',
    tags: ['running'],
  });

  const first = exploreWardrobe([shoe, navy, blue]);
  const second = exploreWardrobe([blue, shoe, navy]);

  assert.deepEqual(first.clusters.map((cluster) => cluster.items.map((entry) => entry.id)), [
    ['blue', 'navy'],
  ]);
  assert.deepEqual(first.outliers.map((candidate) => candidate.item.id), ['shoe']);
  assert.deepEqual(
    second.clusters.map((cluster) => cluster.items.map((entry) => entry.id)),
    first.clusters.map((cluster) => cluster.items.map((entry) => entry.id)),
  );
});

test('flags richly evidenced near-duplicates as potential redundancy', () => {
  const first = item('a', {
    name: 'Navy Oxford Shirt',
    category: 'tops',
    color: 'navy',
    materials: ['cotton'],
    seasons: ['spring', 'autumn'],
    occasions: ['work'],
    formality: 'business',
    fit: 'regular',
    tags: ['oxford', 'office'],
  });
  const second = item('b', {
    name: 'Navy Oxford Work Shirt',
    category: 'tops',
    color: 'navy',
    materials: ['cotton'],
    seasons: ['spring', 'autumn'],
    occasions: ['work'],
    formality: 'business',
    fit: 'regular',
    tags: ['oxford', 'office'],
  });

  const exploration = exploreWardrobe([second, first]);
  assert.equal(exploration.redundancyGroups.length, 1);
  assert.deepEqual(exploration.redundancyGroups[0]?.items.map((entry) => entry.id), ['a', 'b']);
  assert.ok((exploration.redundancyGroups[0]?.meanSimilarity ?? 0) >= 0.8);
});

test('does not call sparse category-and-color matches redundant', () => {
  const first = item('a', { name: 'Plain Shirt A', category: 'tops', color: 'navy' });
  const second = item('b', { name: 'Plain Shirt B', category: 'tops', color: 'navy' });

  const exploration = exploreWardrobe([first, second]);
  assert.equal(exploration.clusters.length, 1);
  assert.deepEqual(exploration.redundancyGroups, []);
});

test('uses stable representative tie-breaking and validates thresholds', () => {
  const alpha = item('z-id', { name: 'Alpha Tee', category: 'tops', color: 'white' });
  const beta = item('a-id', { name: 'Beta Tee', category: 'tops', color: 'white' });
  const cluster = exploreWardrobe([beta, alpha]).clusters[0];

  assert.equal(cluster?.representative.id, 'z-id');
  assert.throws(() => exploreWardrobe([alpha], { clusterThreshold: 2 }), /between 0 and 1/i);
  assert.throws(() => exploreWardrobe([alpha], { redundancyMinEvidence: 0 }), /positive integer/i);
});
