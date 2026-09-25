import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearPurchased,
  createShoppingItem,
  deserializeShoppingItems,
  orderShoppingItems,
  toggleShoppingItem,
} from './shopping-list';

test('creates normalized shopping items', () => {
  const item = createShoppingItem(
    '  Apples  ',
    'item-1',
    ' 2 kg ',
    new Date('2026-09-09T05:00:00Z'),
  );
  assert.equal(item.name, 'Apples');
  assert.equal(item.quantity, '2 kg');
  assert.equal(item.purchased, false);
});

test('keeps purchased items after active items and clears them explicitly', () => {
  const apples = toggleShoppingItem(createShoppingItem('Apples', 'a'));
  const bread = createShoppingItem('Bread', 'b');
  assert.deepEqual(orderShoppingItems([apples, bread]).map((item) => item.id), ['b', 'a']);
  assert.deepEqual(clearPurchased([apples, bread]).map((item) => item.id), ['b']);
});

test('rejects malformed persisted data', () => {
  assert.deepEqual(deserializeShoppingItems('{broken'), []);
  assert.deepEqual(deserializeShoppingItems('[{"id":1}]'), []);
});
