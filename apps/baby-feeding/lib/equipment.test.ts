import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addEquipmentItem,
  deserializeEquipmentState,
  emptyEquipmentState,
  equipmentItems,
  markEquipmentUsed,
  setEquipmentStatus,
} from './equipment';

test('tracks bottle and pumping gear through dirty, washed and sterilized states', () => {
  let state = addEquipmentItem(emptyEquipmentState(), {
    id: 'bottle-1',
    kind: 'bottle',
    updatedAt: 1,
  });
  state = addEquipmentItem(state, { id: 'pump-1', kind: 'pump-kit', updatedAt: 2 });

  state = markEquipmentUsed(state, 'bottle', 'fallback-bottle', 3);
  assert.equal(equipmentItems(state, 'bottle')[0]?.status, 'dirty');
  state = setEquipmentStatus(state, 'bottle-1', 'washed', 4);
  assert.equal(equipmentItems(state, 'bottle')[0]?.status, 'washed');
  state = setEquipmentStatus(state, 'bottle-1', 'sterilized', 5);
  assert.equal(equipmentItems(state, 'bottle')[0]?.status, 'sterilized');
  assert.equal(equipmentItems(state, 'pump-kit')[0]?.status, 'sterilized');
});

test('creates a dirty fallback item when an untracked item is used', () => {
  const state = markEquipmentUsed(emptyEquipmentState(), 'pump-kit', 'pump-use-1', 10);
  assert.deepEqual(state.items, [
    { id: 'pump-use-1', kind: 'pump-kit', status: 'dirty', updatedAt: 10 },
  ]);
});

test('restores only valid unique equipment items', () => {
  const state = deserializeEquipmentState(
    JSON.stringify({
      items: [
        { id: 'a', kind: 'bottle', status: 'washed', updatedAt: 1 },
        { id: 'a', kind: 'bottle', status: 'dirty', updatedAt: 2 },
        { id: 'b', kind: 'pump-kit', status: 'sterilized', updatedAt: 3 },
        { id: 'bad', kind: 'unknown', status: 'dirty', updatedAt: 4 },
      ],
    }),
  );

  assert.deepEqual(state.items, [
    { id: 'a', kind: 'bottle', status: 'washed', updatedAt: 1 },
    { id: 'b', kind: 'pump-kit', status: 'sterilized', updatedAt: 3 },
  ]);
});
