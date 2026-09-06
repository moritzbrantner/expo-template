import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addEquipmentItem,
  deserializeEquipmentState,
  emptyEquipmentState,
  equipmentItems,
  setEquipmentStatus,
} from './equipment';

test('tracks bottle and pumping gear through explicit dirty, washed and sterilized states', () => {
  let state = addEquipmentItem(emptyEquipmentState(), {
    id: 'bottle-1',
    kind: 'bottle',
    updatedAt: 1,
  });
  state = addEquipmentItem(state, { id: 'pump-1', kind: 'pump-kit', updatedAt: 2 });

  state = setEquipmentStatus(state, 'bottle-1', 'dirty', 3);
  assert.equal(equipmentItems(state, 'bottle')[0]?.status, 'dirty');
  state = setEquipmentStatus(state, 'bottle-1', 'washed', 4);
  assert.equal(equipmentItems(state, 'bottle')[0]?.status, 'washed');
  state = setEquipmentStatus(state, 'bottle-1', 'sterilized', 5);
  assert.equal(equipmentItems(state, 'bottle')[0]?.status, 'sterilized');
  assert.equal(equipmentItems(state, 'pump-kit')[0]?.status, 'sterilized');
});

test('changes only the explicitly selected equipment item', () => {
  let state = addEquipmentItem(emptyEquipmentState(), {
    id: 'bottle-1',
    kind: 'bottle',
    updatedAt: 1,
  });
  state = addEquipmentItem(state, { id: 'bottle-2', kind: 'bottle', updatedAt: 2 });

  const next = setEquipmentStatus(state, 'bottle-2', 'dirty', 3);
  assert.equal(equipmentItems(next, 'bottle')[0]?.status, 'sterilized');
  assert.equal(equipmentItems(next, 'bottle')[1]?.status, 'dirty');
  assert.equal(setEquipmentStatus(next, 'missing', 'dirty', 4), next);
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
