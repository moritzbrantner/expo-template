import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addBottleCare,
  addFeed,
  addPumping,
  adjustLocalDays,
  adjustLocalMinutes,
  deserializeFeedingLog,
  dirtyBottleCount,
  emptyFeedingLog,
  latestBottleCare,
  latestFeed,
  parseLocalDateTime,
  removeEntry,
  roundToFiveMinutes,
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
    bottleUsed: false,
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

test('counts bottle uses since the latest cleaning event', () => {
  let log = addFeed(emptyFeedingLog(), {
    id: 'bottle-1',
    milkType: 'formula',
    amountMl: 90,
    occurredAt: 10_000,
    bottleUsed: true,
  });
  log = addFeed(log, {
    id: 'no-bottle',
    milkType: 'breast-milk',
    amountMl: 60,
    occurredAt: 20_000,
    bottleUsed: false,
  });
  log = addFeed(log, {
    id: 'bottle-2',
    milkType: 'formula',
    amountMl: 100,
    occurredAt: 30_000,
    bottleUsed: true,
  });
  log = addBottleCare(log, { id: 'sterilized', kind: 'bottle-sterilize', occurredAt: 35_000 });

  assert.equal(dirtyBottleCount(log), 2);
  assert.equal(latestBottleCare(log, 'bottle-sterilize')?.id, 'sterilized');

  log = addBottleCare(log, { id: 'cleaned', kind: 'bottle-clean', occurredAt: 40_000 });
  assert.equal(dirtyBottleCount(log), 0);

  log = addFeed(log, {
    id: 'bottle-3',
    milkType: 'breast-milk',
    amountMl: 70,
    occurredAt: 50_000,
    bottleUsed: true,
  });
  assert.equal(dirtyBottleCount(log), 1);
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

test('supports deterministic five-minute, hour, and day timestamp adjustments', () => {
  const source = new Date(2026, 8, 5, 14, 3, 40, 500).getTime();
  const rounded = new Date(roundToFiveMinutes(source));
  assert.equal(rounded.getHours(), 14);
  assert.equal(rounded.getMinutes(), 5);
  assert.equal(rounded.getSeconds(), 0);

  const plusHour = new Date(adjustLocalMinutes(rounded.getTime(), 60));
  assert.equal(plusHour.getHours(), 15);
  assert.equal(plusHour.getMinutes(), 5);

  const previousDay = new Date(adjustLocalDays(rounded.getTime(), -1));
  assert.equal(previousDay.getDate(), 4);
  assert.equal(previousDay.getHours(), 14);
  assert.equal(previousDay.getMinutes(), 5);
});

test('deletes individual records', () => {
  const log = addPumping(emptyFeedingLog(), { id: 'pump', amountMl: 140, occurredAt: 10_000 });
  assert.deepEqual(removeEntry(log, 'pump'), emptyFeedingLog());
});

test('recovers safely from malformed local data and upgrades older feed records', () => {
  const restored = deserializeFeedingLog(
    JSON.stringify({
      entries: [
        { id: 'old', kind: 'feed', milkType: 'breast-milk', amountMl: 90, occurredAt: 1 },
        {
          id: 'bottle',
          kind: 'feed',
          milkType: 'formula',
          amountMl: 80,
          occurredAt: 2,
          bottleUsed: true,
        },
        { id: 'clean', kind: 'bottle-clean', occurredAt: 3 },
        { id: 'bad', kind: 'feed', milkType: 'unknown', amountMl: 90, occurredAt: 4 },
      ],
    }),
  );

  assert.deepEqual(restored.entries.map((entry) => entry.id), ['old', 'bottle', 'clean']);
  assert.equal(restored.entries[0]?.kind === 'feed' && restored.entries[0].bottleUsed, false);
  assert.equal(restored.entries[1]?.kind === 'feed' && restored.entries[1].bottleUsed, true);
  assert.equal(dirtyBottleCount(restored), 0);
  assert.deepEqual(deserializeFeedingLog('{broken'), emptyFeedingLog());
});
