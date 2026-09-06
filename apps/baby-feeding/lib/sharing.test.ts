import assert from 'node:assert/strict';
import test from 'node:test';

import { addBottleCare, addBreastfeeding, addFeed, addPumping, emptyFeedingLog } from './feeding';
import {
  buildSharedFeedingUrl,
  decodeSharedFeedingLog,
  encodeSharedFeedingLog,
  feedingLogsEqual,
  SHARE_BASE_URL,
  SHARE_QUERY_PARAM,
} from './sharing';

function populatedLog() {
  let log = addFeed(emptyFeedingLog(), {
    id: 'feed-1',
    milkType: 'breast-milk',
    amountMl: 95,
    occurredAt: 10_000,
    bottleUsed: true,
  });
  log = addBreastfeeding(log, { id: 'nursing-1', occurredAt: 15_000 });
  log = addPumping(log, { id: 'pump-1', amountMl: 120, occurredAt: 20_000 });
  log = addBottleCare(log, { id: 'clean-1', kind: 'bottle-clean', occurredAt: 30_000 });
  return addBottleCare(log, {
    id: 'sterilize-1',
    kind: 'bottle-sterilize',
    occurredAt: 40_000,
  });
}

test('round-trips the complete feeding and bottle-care log through the compact share payload', () => {
  const log = populatedLog();
  const restored = decodeSharedFeedingLog(encodeSharedFeedingLog(log));

  assert.deepEqual(restored, log);
  assert.equal(feedingLogsEqual(restored!, log), true);
});

test('builds a public Pages URL whose query parameter restores the snapshot', () => {
  const log = populatedLog();
  const url = new URL(buildSharedFeedingUrl(log));

  assert.equal(`${url.origin}${url.pathname}`, SHARE_BASE_URL.replace(/\/$/, ''));
  const encodedState = url.searchParams.get(SHARE_QUERY_PARAM);
  assert.notEqual(encodedState, null);
  assert.deepEqual(decodeSharedFeedingLog(encodedState), log);
});

test('keeps version-one share links readable after adding direct breastfeeding records', () => {
  const legacy = JSON.stringify([
    1,
    [
      ['f', 'feed', 10_000, 90, 'f', 1],
      ['p', 'pump', 20_000, 110],
      ['c', 'clean', 30_000],
    ],
  ]);

  assert.deepEqual(decodeSharedFeedingLog(legacy)?.entries.map((entry) => entry.kind), [
    'feed',
    'pumping',
    'bottle-clean',
  ]);
});

test('rejects malformed, unsupported, or partially invalid shared snapshots', () => {
  assert.equal(decodeSharedFeedingLog(null), null);
  assert.equal(decodeSharedFeedingLog('{broken'), null);
  assert.equal(decodeSharedFeedingLog(JSON.stringify([3, []])), null);
  assert.equal(decodeSharedFeedingLog(JSON.stringify([2, [['f', '', 1, 90, 'b', 1]]])), null);
  assert.equal(decodeSharedFeedingLog(JSON.stringify([1, [['n', 'nursing', 1]]])), null);
  assert.equal(decodeSharedFeedingLog(JSON.stringify([2, [['unknown', 'x', 1]]])), null);
});
