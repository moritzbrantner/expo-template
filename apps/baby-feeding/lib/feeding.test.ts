import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addFeed,
  addPumping,
  deserializeFeedingLog,
  emptyFeedingLog,
  latestFeed,
  parseLocalDateTime,
  removeEntry,
} from './feeding';

test('records breast-milk and formula feeds and keeps the latest feed explicit', () => {
  let log = addFeed(emptyFeedingLog(), {
    id: 'breast',
    milkType: 'breast-milk',
    amountMl: 100,
    occurredAt: 10_000,
  });
  log = addFeed(log, {
    id: 'formula',
    milkType: 'formula',
    amountMl: 80,
    occurredAt: 20_000,
  });

  assert.equal(log.entries.length, 2);
  assert.deepEqual(latestFeed(log), {
    id: 'formula',
    kind: 'feed',
    milkType: 'formula',
    amountMl: 80,
    occurredAt: 20_000,
  });
});

test('keeps pumping records separate from feeds while preserving chronology', () => {
  let log = addFeed(emptyFeedingLog(), {
    id: 'later-feed',
    milkType: 'breast-milk',
    amountMl: 120,
    occurredAt: 30_000,
  });
  log = addPumping(log, { id: 'earlier-pump', amountMl: 160, occurredAt: 10_000 });

  assert.deepEqual(
    log.entries.map((entry) => [entry.id, entry.kind]),
    [
      ['earlier-pump', 'pumping'],
      ['later-feed', 'feed'],
    ],
  );
});

test('parses local date and time fields without accepting impossible dates', () => {
  const timestamp = parseLocalDateTime('2026-09-05', '03:15');
  assert.notEqual(timestamp, null);
  const date = new Date(timestamp!);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 8);
  assert.equal(date.getDate(), 5);
  assert.equal(date.getHours(), 3);
  assert.equal(date.getMinutes(), 15);
  assert.equal(parseLocalDateTime('2026-02-31', '03:15'), null);
  assert.equal(parseLocalDateTime('2026-09-05', '25:00'), null);
});

test('deletes individual records', () => {
  const log = addPumping(emptyFeedingLog(), { id: 'pump', amountMl: 140, occurredAt: 10_000 });
  assert.deepEqual(removeEntry(log, 'pump'), emptyFeedingLog());
});

test('recovers safely from malformed local data and drops invalid records', () => {
  const restored = deserializeFeedingLog(
    JSON.stringify({
      entries: [
        { id: 'ok', kind: 'feed', milkType: 'breast-milk', amountMl: 90, occurredAt: 1 },
        { id: 'bad', kind: 'feed', milkType: 'unknown', amountMl: 90, occurredAt: 2 },
      ],
    }),
  );

  assert.deepEqual(restored.entries.map((entry) => entry.id), ['ok']);
  assert.deepEqual(deserializeFeedingLog('{broken'), emptyFeedingLog());
});
