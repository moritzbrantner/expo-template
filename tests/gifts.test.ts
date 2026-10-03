import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addGift,
  addPerson,
  deserializeGiftState,
  emptyGiftState,
  returnToGiverWarning,
  upcomingPlannedGifts,
} from '../apps/gifts/lib/gifts';

test('tracks people and rejects duplicate names independent of case', () => {
  const state = addPerson(emptyGiftState(), { id: 'p1', name: '  Anna  Smith ' });
  assert.equal(state.people[0]?.name, 'Anna Smith');
  assert.throws(() => addPerson(state, { id: 'p2', name: 'anna smith' }), /already exists/);
});

test('warns when a planned regift would go back to the original giver', () => {
  let state = addPerson(emptyGiftState(), { id: 'anna', name: 'Anna' });
  state = addPerson(state, { id: 'ben', name: 'Ben' });
  state = addGift(state, {
    id: 'received-1',
    direction: 'received',
    personId: 'anna',
    title: 'Tea set',
    date: '2026-01-03',
    createdAt: 1,
  });

  assert.match(
    returnToGiverWarning(state, {
      direction: 'planned',
      personId: 'anna',
      sourceGiftId: 'received-1',
    }) ?? '',
    /received from Anna/,
  );

  assert.equal(
    returnToGiverWarning(state, {
      direction: 'planned',
      personId: 'ben',
      sourceGiftId: 'received-1',
    }),
    null,
  );
});

test('orders upcoming planned gifts and excludes past or distant entries', () => {
  let state = addPerson(emptyGiftState(), { id: 'p1', name: 'Anna' });
  state = addGift(state, {
    id: 'past',
    direction: 'planned',
    personId: 'p1',
    title: 'Past',
    date: '2026-09-01',
    createdAt: 1,
  });
  state = addGift(state, {
    id: 'later',
    direction: 'planned',
    personId: 'p1',
    title: 'Later',
    date: '2026-10-01',
    createdAt: 2,
  });
  state = addGift(state, {
    id: 'soon',
    direction: 'planned',
    personId: 'p1',
    title: 'Soon',
    date: '2026-09-08',
    createdAt: 3,
  });
  state = addGift(state, {
    id: 'far',
    direction: 'planned',
    personId: 'p1',
    title: 'Far',
    date: '2027-05-01',
    createdAt: 4,
  });

  assert.deepEqual(
    upcomingPlannedGifts(state, '2026-09-07', 60).map((gift) => gift.id),
    ['soon', 'later'],
  );
});

test('malformed stored data fails closed while valid local data hydrates', () => {
  assert.deepEqual(deserializeGiftState('{broken'), emptyGiftState());

  const hydrated = deserializeGiftState(JSON.stringify({
    people: [{ id: 'p1', name: ' Anna ' }, { id: 3, name: 'bad' }],
    gifts: [
      {
        id: 'g1',
        direction: 'received',
        personId: 'p1',
        title: '  Book  ',
        date: '2026-09-07',
        occasion: ' Birthday ',
        notes: '',
        sourceGiftId: null,
        createdAt: 10,
      },
      {
        id: 'bad',
        direction: 'received',
        personId: 'missing',
        title: 'Ignored',
        date: '2026-09-07',
        createdAt: 10,
      },
    ],
  }));

  assert.deepEqual(hydrated.people, [{ id: 'p1', name: 'Anna' }]);
  assert.equal(hydrated.gifts[0]?.title, 'Book');
  assert.equal(hydrated.gifts[0]?.occasion, 'Birthday');
  assert.equal(hydrated.gifts.length, 1);
});
